# -*- coding: utf-8 -*-
from pathlib import Path
import re

p = Path(r'F:\CTF_比赛\逆向分析\king-akmanage_云资产告警_20261009\extracted\app\dist\electron\renderer.js')
text = p.read_text(encoding='utf-8', errors='ignore')
i = text.find('设置并进入')
chunk = text[max(0, i - 20000): i + 3000]
labels = re.findall(r'label:"([^"]+)"', chunk)
print('labels:', labels)
# brands keys in form
keys = re.findall(r'brands\.(\w+)\.key', chunk)
print('brand refs:', sorted(set(keys)))
# handleSubmit
for pat in ['handleSubmit:function', 'handleReset:function', 'handleSubmitUpdate:function']:
    j = text.find(pat)
    print('\n===', pat, j, '===')
    print(text[j:j + 1200])
