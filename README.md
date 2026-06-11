# LensLog (렌즈로그) - 개발 및 실행 가이드

LensLog는 아날로그 필름 사진의 촬영 데이터(수동 로깅)와 디지털 사진 및 RAW 파일의 메타데이터(EXIF)를 통합 관리하는 웹 플랫폼입니다. 
본 문서는 처음 구동하는 PC(Windows, macOS, Linux) 환경에서 본 프로젝트를 복제하고 개발 서버를 실행하기까지의 전 과정을 안내합니다.
#
---
#
## 1. 전제 조건 및 사전 필수 설치 요소

플랫폼 공통으로 애플리케이션 구동을 위해 아래의 런타임 및 프로그램이 설치되어 있어야 합니다.

### 1.1 기본 필수 도구
* **Node.js (v18.x 또는 v20.x LTS 권장):** 백엔드 및 프론트엔드 구동용 자바스크립트 런타임
* **npm (Node Package Manager):** 패키지 관리 도구 (Node.js 설치 시 자동 포함)
* **Python 3.x:** RAW 이미지 포맷(.DNG, .CR2, .NEF, .ARW) 변환 및 미리보기 추출 모듈 구동용
* **Git:** 소스 코드 리포지토리 복제용

### 1.2 Python 필수 라이브러리
백엔드 서버가 RAW 파일을 처리하기 위해 내부적으로 파이썬 스크립트를 호출하므로, 아래 파이썬 패키지가 필수적으로 설치되어야 합니다.
* `rawpy`: RAW 이미지 바이너리 디모자이킹 및 데이터 추출 라이브러리
* `Pillow (PIL)`: 이미지 프로세싱 및 JPEG 변환/압축용 라이브러리

---

## 2. 운영체제(OS)별 사전 환경 구축 가이드

### 2.1 Windows 환경
1. **Node.js 설치:** [Node.js 공식 홈페이지](https://nodejs.org/)에서 Windows용 LTS 인스턴스(.msi)를 다운로드하여 설치합니다.
2. **Python 3 설치:** [Python 공식 홈페이지](https://www.python.org/)에서 최신 버전을 다운로드합니다. **설치 시 반드시 "Add python.exe to PATH" 체크박스를 선택**해야 터미널에서 명령어를 인식합니다.
3. **Python 라이브러리 설치:** 명령 프롬프트(cmd) 또는 PowerShell을 열고 아래 명령어를 실행합니다.
   ```cmd
   pip install rawpy Pillow
   ```
4. **Windows 환경 주의사항 (`python3` 명령어 연동):**
   본 프로젝트의 백엔드 소스코드는 내부적으로 `python3` 인터프리터 명령어를 호출하도록 설계되어 있습니다. Windows 환경에서는 기본 명령어가 `python`으로 지정되어 있어 실행 오류가 발생할 수 있습니다. 
   * **해결 방법:** PowerShell을 관리자 권한으로 열고 아래 명령어를 실행하여 심볼릭 링크를 생성하거나, Python 설치 폴더 내부의 `python.exe`를 복사하여 `python3.exe`로 이름을 변경해 줍니다.
     ```powershell
     New-Item -ItemType SymbolicLink -Path "$((Get-Command python).Source | Split-Path)\python3.exe" -Value "$((Get-Command python).Source)"
     ```

### 2.2 macOS 환경
1. **Homebrew 설치 (미설치 시):** 터미널을 열고 아래 스크립트를 실행하여 macOS 패키지 관리자를 설치합니다.
   ```bash
   /bin/bash -c "$(curl -fsSL [https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh](https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh))"
   ```
2. **개발 도구 일괄 설치:** Homebrew를 이용해 Node.js와 Python을 설치합니다.
   ```bash
   brew update
   brew install node python
   ```
3. **Python 라이브러리 설치:**
   ```bash
   pip3 install rawpy Pillow
   ```

### 2.3 Linux 환경 (Ubuntu / Debian 계열)
1. **시스템 패키지 업데이트 및 런타임 설치:** 터미널을 열고 아래 패키지들을 차례로 설치합니다.
   ```bash
   sudo apt update
   sudo apt install -y git nodejs npm python3 python3-pip python3-venv build-essential
   ```
2. **Python 라이브러리 설치:** Linux 환경에서는 시스템 파이썬 보안 정책(PEP 668)에 의해 전역 `pip` 설치가 제한될 수 있으므로, 아래와 같이 설치하거나 가상환경 구동을 권장합니다.
   ```bash
   pip3 install rawpy Pillow --break-system-packages
   ```

---

## 3. 프로젝트 복제 및 의존성 설치 (전공통)

사전 환경 구축이 완료되었다면 터미널(또는 CLI 도구)을 통해 소스코드를 복제하고 프론트엔드와 백엔드의 패키지를 설치합니다.

### 3.1 리포지토리 클론
```bash
git clone https://github.com/0IhosuI0/lenslog
cd lenslog
```

### 3.2 백엔드(Backend) 환경 설정 및 패키지 설치
LensLog 백엔드는 의존성 관리를 위해 `lenslog-backend` 폴더 내에서 작업을 수행합니다.
```bash
cd lenslog-backend

# 1. Node.js 의존성 패키지 설치 (sharp, prisma, exiftool-vendored 등)
npm install

# 2. 로컬 데이터베이스 환경 변수 설정
# 폴더 루트에 .env 파일을 생성하고 아래 내용을 입력합니다. (기본 SQLite 경로 지정)
echo "DATABASE_URL=\"file:../prisma/dev.db\"" > .env

# 3. Prisma ORM을 통한 SQLite 데이터베이스 초기화 및 테이블 생성
npx prisma db push
```

### 3.3 프론트엔드(Frontend) 패키지 설치
Vite와 React/JavaScript 기반으로 구성된 프론트엔드 소스 코드를 빌드하기 위한 패키지를 설치합니다.
```bash
cd ../lenslog-app

# 1. Node.js 의존성 패키지 설치
npm install
```

---

## 4. 개발 서버 구동 방법

애플리케이션은 **백엔드 API 서버**와 **프론트엔드 Vite 개발 서버**가 각각 독립적인 포트에서 구동되어 통신합니다. 원활한 구동을 위해 터미널 창을 2개 열어 각각 실행해 줍니다.

### 4.1 백엔드 서버 실행
```bash
cd lenslog-backend
npm run dev
```
* **성공 시 출력:** 서버가 정상 실행되면 콘솔에 데이터베이스 연결 및 포트 활성화 메시지가 출력됩니다. (기본 설정에 따라 Node.js API 가동)

### 4.2 프론트엔드 서버 실행
```bash
cd lenslog-app
npm run dev
```
* **성공 시 출력:** Vite 컴파일러가 구동되며 브라우저로 접속 가능한 로컬 주소가 출력됩니다.
  ```text
  VITE vX.X.X  ready in XXX ms
  ➜  Local:   http://localhost:5173/
  ```
* 터미널에 명시된 `http://localhost:5173/` 주소를 크롬이나 사파리 등 웹 브라우저에 입력하여 LensLog 서비스를 시작합니다.

---

## 5. 초기 구동 트러블슈팅 (FAQ)

**Q. 사진 업로드 시 RAW 파일 변환 에러(`Python 변환 실패`)가 발생합니다.**
* **A1:** 터미널 환경에서 `python3` 명령어를 직접 입력했을 때 인터프리터 쉘이 정상적으로 진입하는지 확인하십시오. Windows 사용자는 환경변수 PATH 설정을 다시 점검하고 `python3` 실행파일 연동 조치를 취해야 합니다.
* **A2:** 백엔드 구동 환경에 `rawpy`와 `Pillow` 패키지가 누락되었을 수 있습니다. 설치 명령어를 재수행하십시오.
 
**Q. 데이터 로딩 중 에러가 발생하거나 장비 등록이 되지 않습니다.**
* **A:** 백엔드 폴더 내부에서 `npx prisma db push` 명령어가 정상적으로 완료되었는지 확인하십시오. `prisma/dev.db` 데이터베이스 파일 생성 여부 및 읽기/쓰기 권한을 확인하십시오.
 
**Q. 다른 PC나 모바일 기기에서 로컬 서버로 접속하고 싶습니다.**
* **A:** 프론트엔드 가동 시 `npm run dev -- --host` 명령어를 사용하여 모든 네트워크 호스트를 허용하도록 구동하고, 백엔드 소스코드 내 `getFullUrl` 통신 유틸리티 파일에 구동 중인 PC의 실제 내부 IP 주소(예: `192.168.x.x`)를 바인딩해 주어야 정상적인 이미지 크로스오리진(CORS) 통신이 가능합니다.