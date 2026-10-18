# nginx: servidor web liviano que entrega archivos estáticos (HTML/CSS/JS)
FROM nginx:alpine

# Copia el sitio a la carpeta que nginx publica por defecto
COPY . /usr/share/nginx/html

# nginx escucha en el puerto 80
EXPOSE 80