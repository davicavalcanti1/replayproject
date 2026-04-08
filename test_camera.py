import cv2
import time

print("=" * 40)
print("DIAGNÓSTICO DE CÂMERA")
print("=" * 40)

found = False
for i in range(5):
    print(f"\nTestando índice {i}...")
    cap = cv2.VideoCapture(i)
    print(f"  isOpened: {cap.isOpened()}")
    if cap.isOpened():
        time.sleep(0.5)
        ret, frame = cap.read()
        print(f"  read: {ret}")
        if ret:
            print(f"  resolução: {frame.shape[1]}x{frame.shape[0]}")
            print(f"  >>> CÂMERA FUNCIONANDO NO ÍNDICE {i} <<<")
            found = True
        cap.release()

if not found:
    print("\nNenhuma câmera encontrada!")
    print("Verifique se outra aplicação está usando a câmera.")

print("\nFim do diagnóstico.")
input("Pressione ENTER para fechar...")
