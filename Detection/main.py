from ultralytics import YOLO

model = YOLO("C:/Unihack2025/ObDetector/venv/runs/detect/trainFaraLateral/weights/best.pt")

results = model.train(data="config.yaml", epochs=150)