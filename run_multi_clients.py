import os
import time

os.system("start cmd /k ts-node mainScript.ts input-file-3.txt")
time.sleep(0.2)
os.system("start cmd /k ts-node mainScript.ts input-file-2.txt")
time.sleep(0.2)
os.system("start cmd /k ts-node mainScript.ts input-file-1.txt")