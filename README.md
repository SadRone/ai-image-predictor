# AI Image Predictor

A minimal web API that lets users upload an image and get **top-5 class predictions** with probabilities using a **pretrained ResNet-50 (ImageNet)** via **PyTorch/torchvision**, served with **FastAPI**.

---

## Features
- **Endpoints**:  
  - `GET /` – quick status  
  - `GET /health` – model/server health  
  - `POST /predict` – `multipart/form-data` image → JSON `{topk, inference_time_ms, model_name}`
- **Model**: ResNet-50 (ImageNet, pretrained), standard ImageNet transforms
- **Docs**: Auto-generated OpenAPI (Swagger UI) at **`/docs`**
- **Validation**: type check (`image/*`) + size limit (≤ **5 MB**)
- **CORS**: open for local development (tighten for production)

---

## Stack
- Python 3.11+, FastAPI, Uvicorn (ASGI), Pydantic v2, Pillow
- PyTorch + torchvision (CPU wheels by default)

---

## Quickstart (Windows PowerShell)

```powershell
# 1) Clone
git clone https://github.com/SadRone/ai-image-predictor.git
cd ai-image-predictor

# 2) Virtual env
py -3.11 -m venv .venv
.\.venv\Scripts\activate
python -m pip install --upgrade pip

# 3) Install deps
python -m pip install fastapi==0.115.0 "uvicorn[standard]==0.30.6" pillow==10.4.0 pydantic==2.9.2
python -m pip install --index-url https://download.pytorch.org/whl/cpu torch torchvision

# 4) Run API
python app.py
# Browse: http://localhost:8000/health  and http://localhost:8000/docs

## API

{
  "topk": [
    {"label": "Labrador retriever", "probability": 0.81},
    {"label": "golden retriever", "probability": 0.05},
    {"label": "...", "probability": 0.03}
  ],
  "inference_time_ms": 64.4,
  "model_name": "resnet50_imagenet"
}

##PROJECT STRUCTURE

app.py              # FastAPI app (ResNet-50 inference)
index.html          # Optional demo UI (drag & drop)
script.js
styles.css
.gitignore

\

