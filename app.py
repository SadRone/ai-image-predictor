import io
import time
from typing import List, Dict, Any

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image, UnidentifiedImageError

import torch
from torchvision import models


app = FastAPI(title="AI Image Predictor", version="0.1.0")

# CORS (open for local dev; tighten for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Load pretrained model (ResNet50, ImageNet) ---
weights = models.ResNet50_Weights.DEFAULT
model = models.resnet50(weights=weights)
model.eval()
preprocess = weights.transforms()
categories = weights.meta.get("categories", [])


# ---- Pydantic models ----
class Prediction(BaseModel):
    label: str
    probability: float


class PredictResponse(BaseModel):
    # Silence the "model_" protected namespace warning in Pydantic v2
    model_config = {"protected_namespaces": ()}

    topk: List[Prediction]
    inference_time_ms: float
    model_name: str = "resnet50_imagenet"


# ---- Routes ----
@app.get("/")
def root() -> Dict[str, Any]:
    return {"status": "ok", "see": ["/health", "/docs"]}


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"status": "ok", "model": "resnet50_imagenet", "num_classes": len(categories)}


@app.post("/predict", response_model=PredictResponse)
async def predict(file: UploadFile = File(...)) -> Any:
    # Basic type/size checks
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an image (jpg/png/webp).")

    raw = await file.read()
    max_bytes = 5 * 1024 * 1024  # 5 MB
    if len(raw) > max_bytes:
        raise HTTPException(status_code=413, detail="File too large. Max 5 MB.")

    try:
        img = Image.open(io.BytesIO(raw)).convert("RGB")
    except UnidentifiedImageError:
        raise HTTPException(status_code=400, detail="Could not decode image.")

    # Preprocess -> [1,3,H,W]
    x = preprocess(img).unsqueeze(0)

    # Inference
    start = time.perf_counter()
    with torch.no_grad():
        logits = model(x)
        probs = torch.softmax(logits, dim=1)[0]
        values, indices = torch.topk(probs, k=5)
    elapsed = (time.perf_counter() - start) * 1000.0

    topk = []
    for v, idx in zip(values.tolist(), indices.tolist()):
        label = categories[idx] if categories and idx < len(categories) else str(idx)
        topk.append({"label": label, "probability": round(v, 6)})

    return {
        "topk": topk,
        "inference_time_ms": round(elapsed, 3),
        "model_name": "resnet50_imagenet",
    }


if __name__ == "__main__":
    import uvicorn
    # Use 127.0.0.1 to avoid confusion (browse at http://localhost:8000)
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
