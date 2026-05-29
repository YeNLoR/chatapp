FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=chatapp.settings
ENV DJANGO_ENV=production

RUN mkdir /app
WORKDIR /app
RUN pip install --upgrade pip
COPY requirements.txt  /app/
RUN pip install --no-cache-dir -r requirements.txt
COPY . /app/
EXPOSE 8000
CMD ["sh","-c","python manage.py migrate && python manage.py collectstatic && daphne -b 0.0.0.0 -p 8000 chatapp.asgi:application"]
