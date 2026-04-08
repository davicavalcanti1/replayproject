import os
os.environ["OPENCV_LOG_LEVEL"] = "ERROR"

import cv2
import time

BACKENDS = [
    ("DSHOW", cv2.CAP_DSHOW),
    ("MSMF",  cv2.CAP_MSMF),
    ("AUTO",  0),
]

print("=" * 50)
print("DIAGNOSTICO COMPLETO DE CAMERAS")
print("=" * 50)

for i in range(10):
    print(f"\n--- Indice {i} ---")
    for bname, backend in BACKENDS:
        cap = cv2.VideoCapture(i, backend)
        if not cap.isOpened():
            cap.release()
            continue
        w = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
        h = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
        if w == 0:
            print(f"  {bname}: abre mas resolucao 0 (virtual/invalida)")
            cap.release()
            continue
        time.sleep(0.4)
        ret, frame = cap.read()
        if ret:
            print(f"  {bname}: OK  {int(w)}x{int(h)}")
        else:
            print(f"  {bname}: abre ({int(w)}x{int(h)}) mas nao le frames")
        cap.release()
        time.sleep(0.2)

print("\n" + "=" * 50)
print("Fim do diagnostico.")
input("Pressione ENTER para fechar...")
