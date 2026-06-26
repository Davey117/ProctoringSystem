# Intelligent Multi-Agent Biometric Proctoring Framework

🛡️ **Production URL:** [https://proctoring-system-two.vercel.app/](https://proctoring-system-two.vercel.app/)  
💻 **Backend API Target:** Hosted via Hugging Face Inference Spaces  

An automated, enterprise-grade academic integrity verification framework. This system utilizes a decoupled architecture combining a high-performance **React (Vite)** frontend client with a deep-learning **FastAPI** backend pipeline to execute real-time facial authentication, blink-based liveness verification, and environment anomaly detection.

---

## 🚀 Key Architectural Features

* **Optimized Blink Liveness Pipeline:** Captures real-time frames to compute the Eye Aspect Ratio (EAR) using `dlib` 68-point facial landmark predictors. Restricting active liveness strictly to biological blink patterns ensures rapid validation while mitigating 2D photograph spoofing threats.
* **Deep Facial Embeddings:** Extracts 128-dimensional facial feature vectors via a `FaceNet` convolutional network to match active session profiles against case-sensitive database records with low latency.
* **Real-Time Object Detection Overwatch:** Runs background `YOLOv8` inference passes on the video stream to continuously flag secondary device threats (cell phones), unauthorized materials, or multiple candidate exposures.
* **Harden Workspace Security (Anti-Tab Excursion):** Implements an automated visibility API tracking loop that takes instant desktop snapshots and stores a 5-second buffered WebM video of prolonged excursions to back up integrity audits.
* **Administrative Security by Obscurity:** Features an isolated Supervisor Overwatch Console route (`/proctor`) decoupled from the global client navigation bar to protect administrative authorization paths from student visibility.

---

## 🛠️ Tech Stack & System Components

### Frontend (Client Node)
* **Framework:** React 18 (Scaffolded via Vite)
* **Routing & Identity Engine:** React Router DOM v6 with a centralized `TabIdentityManager` for dynamic browser header and favicon optimization.
* **Hardware Interface:** React-Webcam stream capture with optimized non-blocking polling intervals.
* **Hosting:** Deployable directly via Vercel Edge Networks.

### Backend (AI Core & Infrastructure)
* **Framework:** FastAPI (Python 3.10+) running on an asymmetric CPU cluster.
* **Computer Vision Libraries:** OpenCV, Dlib (`shape_predictor_68_face_landmarks.dat`), and SciPy (Cosine distance matrix computation).
* **Neural Network Weights:** Keras-FaceNet (Face Embeddings) and Ultralytics YOLOv8 (Object Classification).
* **Security:** Cryptographic password hashing via `bcrypt`.

---

## 📂 Project Directory Structure

```text
├── public/
│   └── vercel.json         # Critical SPA routing rewrite engine rules
├── src/
│   ├── components/
│   │   ├── Register.jsx          # Optimized enrollment terminal
│   │   ├── Login.jsx             # Biometric validation portal
│   │   ├── StudentDashboard.jsx  # Candidate workspace terminal
│   │   ├── ExamWorkspace.jsx     # Anti-occlusion tracking console
│   │   └── ProctorDashboard.jsx  # Supervisor overwatch gate
│   ├── App.jsx             # Route configuration & landing hub
│   └── main.jsx
├── package.json            # Client-side dependency manifest
└── README.md