yazılı sesli ve görüntülü iletişim için bir websitesi

# Geliştirme Serveri Çalıştırma Adımları
Gereksinimler:
linux tabanlı bir işletim sistemi,
docker,
python 3.14,
nodejs ve node package manager,

Adımlar bir linux işletim sistemi ve fish shell kullandığınızı varsayıyor, farklı platfomlarda bazı komutları değiştirmeniz gerekecektir.
1) Repoyu klonla:
```
git clone https://github.com/YeNLoR/chatapp.git
```
2) Chatapp klasörünü aç:
```
cd chatapp
```
3) Python virtual environment oluştur ve aktifleştir:
```
python3.14 -m venv .venv
source .venv/bin/activate.fish
```
4) Python gereksinimlerini yükle:
```
pip install -r requirements.txt
```
5) Nodejs gereksinimlerini yükle ve çalıştır:
```
npm install
npm run build
```
6) Django veritabanı migrasyonlarını çalıştır:
```
python manage.py makemigrations chatapp
python manage.py migrate
```
7) Django serverini çalıştır:
```
python manage.py runserver 0.0.0.0:8000
```
8) Başka bir terminalde docker ile redisi çalıştır:
```
sudo docker run --rm -p 6379:6379 redis:7
```
