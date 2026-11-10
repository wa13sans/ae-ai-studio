# AE AI Studio · Beta 1.0.0

애프터 이펙트 안에서 자연어로 모션그래픽 작업을 요청하고, 작업 목록을 확인한 뒤 레이어와 애니메이션을 만드는 독립형 CEP 패널입니다.

**버전:** `1.0.0-beta.1` · **라이선스:** [사용 전용 · 재배포·재판매 금지](LICENSE) · **UI:** 한국어 / English / 简体中文

[English](docs/README.en.md) · [简体中文](docs/README.zh-CN.md) · [검증 방법](docs/TESTING.md)

Higgsfield나 Magnetic 구독 없이 사용할 수 있습니다. OpenAI GPT·Anthropic Claude API에 연결하거나, **Ollama로 로컬 모델을 실행**할 수 있습니다. GPT·Claude를 선택하면 해당 제공사의 API 키와 이용 권한이 필요하며, API 요금은 제공사의 정책을 따릅니다. 로컬 모델은 유료 AI 구독이나 API 키 없이 사용할 수 있고, 처리 속도는 컴퓨터와 모델에 따라 달라집니다.

## 만들 수 있는 것

- 컴포지션(Composition), 널(Null), 텍스트(Text), 솔리드(Solid), 사각형·타원 Shape, Adjustment Layer 생성
- 새 레이어의 Position, Scale, Rotation, Opacity, Anchor Point 설정
- 키프레임과 Linear / Ease 애니메이션
- 새 레이어끼리 부모 연결(Parenting), 컴포지션 마커(Marker)
- API 연결 없이 확인할 수 있는 데모 작업
- 생성 전 작업 목록 확인, 실행 후 한 번의 Undo

초보자는 일상적인 문장으로 요청하고, 전문가는 시간·해상도·값을 함께 지정할 수 있습니다. AI가 반환한 JavaScript를 실행하지 않고, 허용된 작업만 로컬에서 검사해 적용합니다. 이 베타에서는 기존 레이어 수정·삭제, Expression, 임의 이펙트, 파일 가져오기, 렌더링을 지원하지 않습니다.

## 설치 — Windows

1. 다운로드한 ZIP을 **전부 압축 해제**합니다. `extension`, `scripts`, `docs`가 같은 폴더에 있어야 합니다.
2. After Effects를 종료합니다.
3. 압축을 푼 프로젝트 폴더에서 터미널을 엽니다.
4. 다음 명령을 실행합니다. 관리자 권한은 필요하지 않습니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1 -EnableDebugMode
```

5. After Effects를 다시 실행합니다.
6. **Window → Extensions → AE AI Studio**를 엽니다. 메뉴가 번역되어 있으면 **창 → 확장**에 해당합니다.
7. 패널을 다른 패널 옆으로 드래그해 고정합니다.

설치 위치는 `%APPDATA%\Adobe\CEP\extensions\com.aeaistudio.panel`입니다. 이전 설치가 있으면 `%APPDATA%\Adobe\CEP\ae-ai-studio-backups`에 보관합니다.

이 배포본은 서명되지 않은 개발용 베타입니다. `-EnableDebugMode`는 현재 사용자에 대해 **CSXS.11·CSXS.12의 CEP 디버그 모드**를 켭니다. 이 설정은 다른 서명되지 않은 CEP 확장에도 적용됩니다. 디버그 모드가 이미 활성화되어 있다면 해당 옵션을 생략할 수 있습니다. 설치 프로그램은 실행 정책을 영구 변경하지 않습니다.

## 설치 — macOS

After Effects를 종료하고, 압축을 푼 프로젝트 폴더의 터미널에서 실행합니다.

```bash
bash scripts/install-macos.sh --enable-debug-mode
```

After Effects를 다시 연 뒤 **Window → Extensions → AE AI Studio**를 선택합니다. 설치 위치는 `~/Library/Application Support/Adobe/CEP/extensions/com.aeaistudio.panel`입니다. 이전 설치는 `~/Library/Application Support/Adobe/CEP/ae-ai-studio-backups`에 보관합니다. 디버그 모드의 범위는 Windows와 같습니다.

## 처음 사용하기

1. 언어 선택에서 한국어, English, 简体中文을 선택합니다.
2. **AI 연결 → 사용할 AI**에서 Ollama · Local, OpenAI · GPT, Anthropic · Claude를 선택합니다. 기본값은 로컬 Ollama입니다.
3. **모델 ID**에 사용할 모델 ID를 입력합니다. 제공사 계정에서 사용 가능한 모델을 선택해야 합니다.
4. OpenAI·Anthropic이면 **API 키**를 입력합니다. 키는 현재 패널 세션 메모리에만 유지되며 파일이나 설정 저장소에 저장하지 않습니다.
5. 기존 컴포지션에 새 레이어를 만들려면 해당 컴포지션을 활성화합니다. 새 컴포지션부터 만들려면 요청에 이를 명시합니다.
6. **만들고 싶은 작업**에 요청을 입력하고 **작업 생성**을 누릅니다.
7. **실행 미리보기**의 작업 목록을 읽고 **AE에서 실행**을 누릅니다.
8. 결과를 되돌리려면 Windows는 **Ctrl+Z**, macOS는 **Cmd+Z**를 누릅니다.

요청 처리 중에는 취소할 수 있습니다. API 오류가 발생하면 키·모델·연결을 확인한 뒤 직접 다시 요청하세요. 자동으로 유료 요청을 재시도하지 않습니다.

### 로컬 모델로 사용하기

1. [Ollama](https://ollama.com/)를 별도로 설치합니다.
2. 터미널에서 원하는 모델을 내려받습니다. 예:

```bash
ollama pull qwen2.5:7b
```

3. Ollama 앱 또는 서비스를 실행합니다. 서비스가 실행 중이 아니라면 `ollama serve`를 사용합니다.
4. 패널에서 **Ollama · Local**을 선택하고 **모델 ID**에 `qwen2.5:7b`를 입력합니다.
5. API key 없이 요청합니다.

패널의 로컬 연결 주소는 `http://127.0.0.1:11434`입니다. 작은 로컬 모델은 복잡한 계획을 틀리게 만들 수 있으므로 짧고 구체적인 요청부터 시작하세요. **AI 연결 없이 데모 사용**으로 먼저 패널 동작을 확인할 수도 있습니다.

## 따라 하기 예시

**첫 레이어 만들기**

> 새 1920×1080, 30fps, 5초 컴포지션을 만들고, 가운데에 “HELLO”라는 흰색 텍스트를 만들어 줘. 글자 크기는 160으로 해 줘.

**널로 묶기**

> 현재 컴포지션에 “CTRL” 널과 파란 사각형을 만들고, 사각형을 널의 자식으로 연결해 줘.

**타이틀 애니메이션**

> 새 1920×1080, 30fps, 5초 컴포지션을 만들어 줘. “MOTION” 텍스트가 0초에는 화면 중앙보다 150픽셀 아래, 1초에는 중앙에 오도록 Ease로 움직여 줘. Opacity는 0초 0, 0.5초 100으로 해 줘.

**English**

> Create a 1920×1080, 30 fps, 5-second composition. Add a white title “MOTION” in the center and ease its scale from 80% at 0 seconds to 100% at 1 second.

**中文**

> 新建1920×1080、30fps、5秒的合成，在中央添加白色文字“MOTION”，并让不透明度从0秒的0变为1秒的100。

## 데이터와 실행 방식

- API 키는 선택한 제공사의 공식 API 요청에만 사용합니다.
- 클라우드 제공자를 선택하면 입력한 요청과 허용한 컴포지션 요약이 해당 제공사로 전송됩니다. 로컬 Ollama는 위의 루프백 주소로 전송합니다.
- **현재 컴포지션 정보를 AI에 포함**은 기본으로 켜져 있으며 해제할 수 있습니다. 전달 정보는 크기·길이·FPS·현재 시간뿐입니다. 컴포지션 이름과 레이어 이름은 보내지 않습니다. 영상·오디오·프로젝트 파일·스크린샷을 자동 업로드하지 않습니다.
- 작업 계획은 최대 **40개 작업**, 키프레임은 총 **200개**입니다. 새 컴포지션은 가로·세로 최대 **4096px**, 최대 **300초**, 최대 **120fps**입니다.
- 모든 작업은 2D 레이어 기준이며, 생성한 레이어만 Transform·Parent 대상으로 사용합니다.
- 적용 직전 현재 컴포지션을 다시 확인합니다. 미리보기 후 다른 컴포지션으로 이동했다면 다시 생성하세요.
- 하나의 Undo 그룹으로 실행합니다. 실행 중 호스트 오류가 발생하면 표시된 오류를 확인하고 Undo로 복구합니다.
- 요청 내역과 AI 답변은 영구 저장하지 않습니다.

## 개발·배포

필요한 개발 도구는 **Node.js 18 이상**입니다. AE 실행 자체에는 별도 Node.js 설치가 필요하지 않습니다. 패널은 CEP에 포함된 런타임을 사용합니다.

```bash
npm test
npm run package
```

배포 ZIP과 SHA-256 파일이 `dist/`에 생성됩니다. 외부 패키지 설치나 `npm install`은 필요하지 않습니다.

이 프로젝트는 **JavaScript + ExtendScript**로 제작되었습니다. Java 런타임이나 `.java` 프로그램이 아닙니다. 패널과 AE를 연결하는 표준 CEP 구조를 사용합니다.

## 호환성과 베타 검증 범위

AE 2022 이상을 목표로 하는 CEP 패널입니다. 매니페스트의 호스트 허용 범위가 실제 모든 AE 버전에서의 동작 검증을 의미하지는 않습니다.

자동 테스트는 계획 검사, API 요청·응답 처리, ZIP 무결성과 **모의 AE 환경**을 검사합니다. 실제 After Effects에서의 실행, 실제 API 키·Ollama 모델을 이용한 품질·속도 검사는 별도의 수동 확인이 필요합니다. 자세한 절차는 [TESTING.md](docs/TESTING.md)에 있습니다.

패널이 메뉴에 보이지 않으면 전체 압축 해제 여부, 사용자 설치 위치, CEP 디버그 모드, AE 재시작을 먼저 확인하세요. 일반 웹브라우저에서 `index.html`을 열면 AE 브리지가 없어 실제 레이어 생성은 작동하지 않습니다.

## 제거·디버그 모드 끄기

After Effects를 종료하고 위 설치 위치의 **com.aeaistudio.panel 폴더만** 삭제합니다. 백업을 복원하려면 백업 폴더를 해당 설치 위치로 복사합니다.

디버그 모드를 끄면 다른 서명되지 않은 CEP 확장도 열리지 않을 수 있습니다. 원하는 경우 다음 값을 0으로 바꿉니다.

Windows PowerShell:

```powershell
Set-ItemProperty -Path 'HKCU:\Software\Adobe\CSXS.11' -Name PlayerDebugMode -Value '0'
Set-ItemProperty -Path 'HKCU:\Software\Adobe\CSXS.12' -Name PlayerDebugMode -Value '0'
```

macOS:

```bash
defaults write com.adobe.CSXS.11 PlayerDebugMode 0
defaults write com.adobe.CSXS.12 PlayerDebugMode 0
```

## 참고 문서

- [Adobe CEP 12 Cookbook](https://github.com/Adobe-CEP/CEP-Resources/blob/master/CEP_12.x/Documentation/CEP%2012%20HTML%20Extension%20Cookbook.md)
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Claude Messages API](https://platform.claude.com/docs/en/api/messages)
- [Ollama API](https://docs.ollama.com/api)

## 라이선스

[AE AI Studio Use-Only License 1.0](LICENSE)을 적용합니다.

- **허용:** 개인 학습, 내부 사용, 상업적 영상 제작, 비공개 수정 및 백업.
- **금지:** 권리자의 사전 서면 허가 없는 프로그램·수정본·소스 상당 부분의 무료/유료 재배포, 재판매, 재라이선스 및 번들 배포.
- **작업물:** 소프트웨어 코드를 포함하지 않는 MV·BGA 영상, 이미지, 프로젝트 결과물의 공개·납품·판매는 허용합니다. 공식 배포 링크도 공유할 수 있습니다.

2026-11-10(한국 시간)의 라이선스 변경 커밋부터 이 조건으로 배포합니다. 앱 버전은 `1.0.0-beta.1`을 유지합니다. 이전 MIT 배포본에 이미 부여된 권한을 소급 취소하지 않습니다. [이전 MIT 커밋](https://github.com/wa13sans/ae-ai-studio/tree/f42fd4f73a69f3c56963b068cd613b417888f158)은 해당 조건을 유지합니다.

재배포를 제한하는 사용자 정의 라이선스이므로 오픈 소스 라이선스가 아닙니다. 공개 저장소의 열람·GitHub 내 포크 권한은 [GitHub 약관](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#5-license-grant-to-other-users)에 따릅니다. Adobe 제품과 각 AI 제공사의 서비스 이용 조건은 별도로 적용됩니다.
