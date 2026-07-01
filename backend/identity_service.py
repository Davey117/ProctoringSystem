from fastapi import FastAPI, File, UploadFile, Form, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import cv2
import dlib
import numpy as np
from keras_facenet import FaceNet
from scipy.spatial import distance
import json
import os
import hmac
import hashlib
import psycopg2
from datetime import datetime, timedelta
import sqlite3
from ultralytics import YOLO
import bcrypt

app = FastAPI()

# --- Security & CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Base Directory Allocations & System Routing ---
UPLOAD_DIR = "static/profiles"
INCIDENT_DIR = "static/incidents"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(INCIDENT_DIR, exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")

# --- Global Live Telemetry State Store ---
LIVE_EXAM_SESSIONS = {}

# --- Infrastructure ---
DB_URL = os.environ.get("DATABASE_URL")
LANDMARK_PATH = "shape_predictor_68_face_landmarks.dat"
SECRET_KEY = b"proctor_super_secret_defense_key"

def get_db_connection():
    try: 
        return psycopg2.connect(DB_URL)
    except Exception as e:
        print(f"Database Connection Error: {e}")
        return None

# --- Proctor Authentication Constants ---
PROCTOR_SESSION_TOKEN = os.environ.get("PROCTOR_SESSION_TOKEN", "proctor_overwatch_secure_token_2026").strip()

# --- AI Core ---
print("Loading AI Core on CPU...")
embedder = FaceNet()
detector = dlib.get_frontal_face_detector()
predictor = dlib.shape_predictor(LANDMARK_PATH)
yolo_model = YOLO('yolov8n.pt') 

def extract_features(frame):
    try:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray) 
        faces = detector(gray, 1) 
        if len(faces) == 0: 
            return False, None
        face_resized = cv2.resize(frame, (160, 160))
        embedding = embedder.embeddings([face_resized])[0]
        return True, embedding.tolist()
    except Exception: 
        return False, None

def calculate_ear(eye):
    A = distance.euclidean(eye[1], eye[5])
    B = distance.euclidean(eye[2], eye[4])
    C = distance.euclidean(eye[0], eye[3])
    return (A + B) / (2.0 * C)

# --- Connection Manager ---
class ConnectionManager:
    def __init__(self): 
        self.active_connections = []
    async def connect(self, websocket): 
        await websocket.accept()
        self.active_connections.append(websocket)
    def disconnect(self, websocket): 
        self.active_connections.remove(websocket)
    async def broadcast(self, message):
        for connection in self.active_connections:
            try: 
                await connection.send_json(message)
            except: 
                pass

manager = ConnectionManager()

# --- Endpoints ---

@app.post("/enroll/")
async def enroll_user(
    username: str = Form(...), 
    full_name: str = Form(...), 
    password: str = Form(...), 
    file: UploadFile = File(...)
):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    is_live, embedding = extract_features(frame)
                
    if not embedding: 
        raise HTTPException(status_code=400, detail="No face detected. Please try again.")
                
    filename = f"{username.replace('/', '_')}.jpg"
    file_path = os.path.join(UPLOAD_DIR, filename)
    with open(file_path, "wb") as buffer:
        buffer.write(contents)
                    
    profile_image_url = f"/static/profiles/{filename}"
    hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection severed.")
                
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO students (matric_number, full_name, password_hash, biometric_embedding, profile_image_url) 
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (matric_number) DO UPDATE SET 
                full_name = EXCLUDED.full_name,
                password_hash = EXCLUDED.password_hash,
                biometric_embedding = EXCLUDED.biometric_embedding,
                profile_image_url = EXCLUDED.profile_image_url;
        """, (username, full_name, hashed_pw, json.dumps(embedding), profile_image_url))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database write failure: {str(e)}")
    finally:
        cursor.close()
        conn.close()
                        
    return {"status": "success", "message": "Enrollment complete"}

@app.post("/login/")
async def login_user(username: str = Form(...), password: str = Form(...), file: UploadFile = File(...)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT password_hash, biometric_embedding FROM students WHERE matric_number = %s", (username,))
    result = cursor.fetchone()
    cursor.close(); conn.close()
            
    if not result: 
        raise HTTPException(status_code=401, detail="User not found")
            
    stored_hash, stored_embedding = result
    if not bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
            
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    is_live, live_embedding = extract_features(cv2.imdecode(nparr, cv2.IMREAD_COLOR))
            
    if not live_embedding or distance.cosine(np.array(stored_embedding), np.array(live_embedding)) > 0.4:
        raise HTTPException(status_code=401, detail="Biometric failure")
                
    return {"status": "success", "session_id": f"session_{username}", "token": "jwt_placeholder"}

@app.get("/api/profile/{matric_number}")
async def get_student_profile(matric_number: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT full_name, profile_image_url FROM students WHERE matric_number = %s", (matric_number,))
    result = cursor.fetchone()
    cursor.close(); conn.close()
    if not result: 
        raise HTTPException(status_code=404, detail="Student not found")
    return {"full_name": result[0], "profile_image_url": result[1]}

@app.post("/api/verify-credentials")
async def verify_credentials(username: str = Form(...), password: str = Form(...)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT password_hash, full_name, profile_image_url FROM students WHERE matric_number = %s", (username,))
    result = cursor.fetchone()
    cursor.close(); conn.close()
            
    if not result: 
        raise HTTPException(status_code=401, detail="User not found")
            
    stored_hash, full_name, profile_url = result
    if not bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
            
    return {"status": "success", "full_name": full_name, "profile_url": profile_url}

# --- OPTIMIZED TRACKING ENGINE ---
@app.post("/api/verify_action")
async def verify_action(action: str = Form(...), file: UploadFile = File(...)):
    try:
        contents = await file.read()
        frame = cv2.imdecode(np.frombuffer(contents, np.uint8), cv2.IMREAD_COLOR)
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = detector(gray, 1)
                                
        if len(faces) == 0: 
            return {"verified": False, "reason": "No face detected"}
                                    
        if action == "front":
            return {"verified": True}
                        
        landmarks = predictor(gray, faces[0])
                        
        # Streamlined Liveness Vector verification tracking down to eye blink loops only
        if action == "blink":
            left_eye = np.array([(landmarks.part(i).x, landmarks.part(i).y) for i in range(36, 42)])
            right_eye = np.array([(landmarks.part(i).x, landmarks.part(i).y) for i in range(42, 48)])
            ear = (calculate_ear(left_eye) + calculate_ear(right_eye)) / 2.0
            return {"verified": bool(ear < 0.20)} 

        return {"verified": False, "reason": "Unknown action"}
                
    except Exception as e:
        print(f"Server Error in verify_action: {str(e)}")
        return {"verified": False, "reason": "Server error processing frame"}

@app.post("/api/proctor/login")
async def proctor_login(username: str = Form(...), password: str = Form(...)):
    input_username = username.strip()
    input_password = password.strip()
        
    expected_username = os.environ.get("PROCTOR_USERNAME", 'admin').strip().replace("\r", "").replace('"', '').replace("'", "")
    expected_password_plain = os.environ.get("PROCTOR_PASSWORD", 'admin').strip().replace("\r", "").replace('"', '').replace("'", "")      
    
    if input_username == expected_username and input_password == expected_password_plain:
        return {"status": "success", "token": PROCTOR_SESSION_TOKEN}
            
    raise HTTPException(status_code=401, detail="Invalid Security Key Credentials.")

@app.websocket("/ws/proctor")
async def websocket_endpoint(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if token != PROCTOR_SESSION_TOKEN:
        print("🚨 Unauthorized WebSocket handshake attempt rejected.")
        await websocket.close(code=1008)  
        return
                
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.post("/api/log_tab_switch")
async def log_tab_switch(
    username: str = Form(...),
    file: UploadFile = File(None)
):
    image_url = None
    if file:
        timestamp = int(datetime.now().timestamp())
        filename = f"tab_exit_{username.replace('/', '_')}_{timestamp}.jpg"
        file_path = os.path.join(INCIDENT_DIR, filename)
                        
        contents = await file.read()
        with open(file_path, "wb") as buffer:
            buffer.write(contents)
                        
        image_url = f"/static/incidents/{filename}"
        
    if username in LIVE_EXAM_SESSIONS:
        LIVE_EXAM_SESSIONS[username]["tabs"] += 1
                
        if LIVE_EXAM_SESSIONS[username]["tabs"] > 1:
            LIVE_EXAM_SESSIONS[username]["status"] = "CRITICAL"
        elif LIVE_EXAM_SESSIONS[username]["status"] == "SECURE":
            LIVE_EXAM_SESSIONS[username]["status"] = "WARNING"
                            
        payload = {
            "type": "TELEMETRY_UPDATE",
            "active_feeds": list(LIVE_EXAM_SESSIONS.values()),
            "new_log": {
                "time": datetime.now().strftime("%H:%M:%S"),
                "matric": username,
                "exam": LIVE_EXAM_SESSIONS[username]["exam"],
                "type": "📸 Evidence: Tab Switch",
                "detail": "Candidate navigated out of the strict browser focus area.",
                "image_url": image_url
            }
        }
        await manager.broadcast(payload)
                
    return {"status": "success"}

@app.post("/api/proctor_telemetry")
async def process_proctor_telemetry(
    username: str = Form(...),
    exam_id: str = Form(...),
    file: UploadFile = File(...)
):
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                        
        if frame is None:
            raise HTTPException(status_code=400, detail="Invalid frame matrix.")
            
        live_filename = f"live_{username.replace('/', '_')}.jpg"
        live_path = os.path.join(UPLOAD_DIR, live_filename)
        with open(live_path, "wb") as buffer:
            buffer.write(contents)
            
        results = yolo_model(frame, verbose=False)[0]
        detected_violations = []
        person_count = 0
        
        for box in results.boxes:
            class_id = int(box.cls[0].item())
            confidence = float(box.conf[0].item())
            if class_id == 0 and confidence > 0.45:
                person_count += 1
            if confidence > 0.30:
                if class_id == 67:                      
                    detected_violations.append("Cell Phone")
                elif class_id == 73:                      
                    detected_violations.append("Unauthorized Material")
                elif class_id == 63:                      
                    detected_violations.append("Secondary Device")
                    
        if person_count > 1:
            detected_violations.append("Multiple Faces")
        elif person_count == 0:
            detected_violations.append("Absence Threat")
            
        if username not in LIVE_EXAM_SESSIONS:
            LIVE_EXAM_SESSIONS[username] = {
                "matric": username,
                "name": f"Student ({username})",  
                "exam": exam_id,
                "tabs": 0,
                "phones": 0,
                "absence": 0,
                "materials": 0,
                "multiple_faces": 0,
                "status": "SECURE",
                "live_frame_url": ""
            }
            
        LIVE_EXAM_SESSIONS[username]["live_frame_url"] = f"/static/profiles/{live_filename}?t={int(datetime.now().timestamp())}"
        
        for v in detected_violations:
            if "Phone" in v or "Device" in v:
                LIVE_EXAM_SESSIONS[username]["phones"] += 1
            elif "Absence" in v:
                LIVE_EXAM_SESSIONS[username]["absence"] += 1
            elif "Material" in v:
                LIVE_EXAM_SESSIONS[username]["materials"] += 1
            elif "Faces" in v:
                LIVE_EXAM_SESSIONS[username]["multiple_faces"] += 1
                
        student_logs = LIVE_EXAM_SESSIONS[username]
        if student_logs["phones"] > 2 or student_logs["tabs"] > 1 or student_logs["multiple_faces"] > 3:
            LIVE_EXAM_SESSIONS[username]["status"] = "CRITICAL"
        elif student_logs["phones"] > 0 or student_logs["absence"] > 2 or student_logs["materials"] > 0:
            LIVE_EXAM_SESSIONS[username]["status"] = "WARNING"
        else:
            LIVE_EXAM_SESSIONS[username]["status"] = "SECURE"
            
        payload = {
            "type": "TELEMETRY_UPDATE",
            "active_feeds": list(LIVE_EXAM_SESSIONS.values()),
            "new_log": {
                "time": datetime.now().strftime("%H:%M:%S"),
                "matric": username,
                "exam": exam_id,
                "type": detected_violations[0] if detected_violations else "Clean Frame",
                "detail": f"Anomalies Flagged: {', '.join(detected_violations)}"
            } if detected_violations else None
        }
                        
        await manager.broadcast(payload)
        return {
            "status": "processed", 
            "violations": detected_violations,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        print(f"Telemetry Core Engine failure: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI Core processing error: {str(e)}")

@app.post("/api/upload_incident_video")
async def upload_incident_video(
    username: str = Form(...),
    violation_type: str = Form(...),
    file: UploadFile = File(...)
):
    try:
        timestamp = int(datetime.now().timestamp())
        filename = f"incident_{username.replace('/', '_')}_{timestamp}.webm"
        file_path = os.path.join(INCIDENT_DIR, filename)
        contents = await file.read()
        with open(file_path, "wb") as buffer:
            buffer.write(contents)
        video_url = f"/static/incidents/{filename}"
        
        payload = {
            "type": "INCIDENT_VIDEO_LOG",
            "log": {
                "id": timestamp,
                "time": datetime.now().strftime("%H:%M:%S"),
                "matric": username,
                "exam": "Active Session",
                "type": f"🎬 Evidence Captured: {violation_type}",
                "detail": "System locked a 5-second video buffer of the incident.",
                "video_url": video_url
            }
        }
        await manager.broadcast(payload)
        return {"status": "success", "video_url": video_url}
    except Exception as e:
        print(f"Error saving video incident: {e}")
        raise HTTPException(status_code=500, detail="Failed to store video clip.")