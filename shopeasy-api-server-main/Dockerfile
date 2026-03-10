# 1. 베이스 이미지: Node.js 20 + Alpine Linux (경량)
FROM node:20-alpine

# 2. 작업 디렉토리 설정
WORKDIR /app

#보안적용 1. 비특권 사용자 그룹 및 사용자 생성
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# 3. package.json과 lock 파일만 먼저 복사 (캐싱 최적화)
COPY package*.json ./

# 4. 프로덕션 의존성만 설치
RUN npm ci --production

# 5. 나머지 소스 코드 복사
COPY . .

#보안적용 2. 앱파일의 소유권을 appuser로 변경
RUN chown -R appuser:appgroup /app
#보안적용 3. 이후 명령어는 appuser로 실행
USER appuser

# 6. 앱이 사용하는 포트 선언
EXPOSE 5000

# 7. 컨테이너 시작 시 실행할 명령
# 7. 컨테이너 시작 시 실행할 명령
CMD ["sh", "-c", "node seed.js && node src/app.js"]
