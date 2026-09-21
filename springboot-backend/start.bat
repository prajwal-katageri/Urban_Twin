@echo off
REM UrbanTwin — Spring Boot startup script
REM Sets environment variables from .env and starts the Spring Boot server

set POSTGRES_JDBC_URL=jdbc:postgresql://ep-snowy-darkness-b3g2skxt-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
set POSTGRES_USER=neondb_owner
set POSTGRES_PASSWORD=npg_4nGMfFDJ1oXe
set FLASK_SIM_URL=http://localhost:5001
set CORS_ORIGINS=http://localhost:3000,http://localhost:5173

echo [UrbanTwin] Starting Spring Boot on port 8082...
mvn spring-boot:run -q
