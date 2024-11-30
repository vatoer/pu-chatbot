# README

### Raichat

Raichat integrates **WhatsApp Web** with AI-powered customer service functionality using **LangChain** and **Google Generative AI**. Below is a breakdown of the main components:

![I-know-it](tau.png)

figure 1. raichat answer base on its embedding text

![i-do-not-know](tidak-tau.png)
---

### **1. Environment Setup**
- **dotenv** is used to load environment variables from a `.env` file, such as `API_KEY` for Google Generative AI.
- The Google service account key file (`key.json`) is set to `GOOGLE_APPLICATION_CREDENTIALS`.

we dont use vertex AI because of some payment issue

---

### **2. WhatsApp Client Initialization**
- **`whatsapp-web.js`**:
  - Manages the interaction with WhatsApp via the web interface.
  - **`Client`** and **`LocalAuth`** are used to create and manage the authentication session.
  - **QR Code Login**: Displays a QR code to log in to WhatsApp.
  - **Event Listeners**:
    - `on("qr")`: Generates and logs the QR code for user login.
    - `on("authenticated")`: Confirms successful authentication.
    - `on("ready")`: Indicates the WhatsApp client is ready to send/receive messages.
    - `on("message")`: Handles incoming messages and sends automated replies.

---

### **3. AI Model Setup**
- **LangChain**: Provides a framework for working with language models and document retrieval.
- **Google Generative AI**:
  - Chat model (`gemini-1.5-flash`) is used for generating human-like responses.
  - Embeddings model (`text-embedding-004`) is used to create vector representations of text data for retrieval tasks.
- **MemoryVectorStore**:
  - Stores preprocessed data (`synthetic_data.txt`) as embeddings.
  - Acts as a retriever for relevant information.
- **Prompt Template**:
  - Specifies the system behavior, user interaction style, and task description.
  - Includes context, such as responding politely in Indonesian and adhering to predefined constraints.

---

### **4. AI Chains**
- **Question Answering Chain**:
  - Processes questions and generates answers based on the AI model.
- **Retrieval Augmented Generation (RAG)** Chain:
  - Combines document retrieval with the AI model to provide contextually accurate responses.

---

### **5. Message Handling**
- The `handleChat` function processes incoming WhatsApp messages:
  - Integrates the prompt template with the user's question.
  - Uses the RAG chain to retrieve relevant data.
  - Generates a response using the AI model.
- Message Types:
  - **`!ping`**: Replies with "pong" (test message).
  - **`!echo <text>`**: Echoes the input text back to the user.
  - **`!q <question>`**: Processes the question using the AI model and returns a generated response.
  - **Other**: Responds with a default message if no specific command is detected.

---

### **6. Error Handling**
- The `handleError` function logs errors and ensures graceful handling of issues like authentication failures or disconnections.

---

### **7. Puppeteer Integration**
- **Puppeteer**: Configured as the underlying browser engine for `whatsapp-web.js`, ensuring headless operation for automation.

---

### **8. Main Function**
- The `main` function initializes the WhatsApp client:
  - Authenticates using the local strategy.
  - Sets up event listeners for logging in, receiving messages, and handling disconnections.
  - Begins processing incoming messages once the client is ready.

---

### **Workflow Overview**
1. **WhatsApp Login**:
   - User logs in via QR code.
   - Client becomes ready to handle messages.

2. **AI Processing**:
   - User sends a command (`!q <question>`).
   - Question is processed using RAG and LangChain.
   - AI generates a polite, contextually relevant response.

3. **Response Delivery**:
   - Generated response is sent back to the user via WhatsApp.

4. **Error Handling**:
   - Logs errors and ensures the bot restarts cleanly in case of disconnections.

---

### **Features and Use Cases**
- Automated customer service.
- AI-enhanced question answering.
- Integration of LangChain for advanced document retrieval.
- Real-time WhatsApp messaging with dynamic responses.


## DEPLOYMENT

Prerequisites

- git
- pnpm 

Clone and install 

```sh
git clone https://github.com/vatoer/pu-chatbot.git
cd pu-chatbot
pnpm install
```

configure your `.env` file

```conf
GOOGLE_API_KEY=${API_KEY}
API_KEY=${API_KEY}
```

Run chatbot

prepare your whatsapp

```sh
pnpm nodemon chat5.js
```

atau

```sh
pnpm start
```

it will show you a qr code, scan with your whatsapp

asking chatbot, chat to your whatsapp from other number in bahasa indonesia

```sh
!q siapa kamu
!q siapa stargan?
```

## development

```sh
pnpm add whatsapp-web.js qrcode-terminal puppeteer dotenv fs nodemon @google/generative-ai @langchain/textsplitters langchain @langchain/google-genai @langchain/core
```

To install Git, follow these steps based on your operating system:

---

## Prerequisites Installation Guide: Git and pnpm

### **1. Windows**

1. **Download the Git Installer:**
   - Visit the official Git website: [https://git-scm.com](https://git-scm.com).
   - Download the latest Git version for Windows.

2. **Run the Installer:**
   - Open the downloaded `.exe` file.
   - Follow the installation steps. You can use the default settings unless you have specific preferences.

3. **Configure Git:**
   - Open Git Bash or Command Prompt.
   - Set your name and email:
     ```bash
     git config --global user.name "Your Name"
     git config --global user.email "your.email@example.com"
     ```

4. **Verify Installation:**
   - Open Git Bash or Command Prompt and run:
     ```bash
     git --version
     ```
   - You should see the installed Git version.

---

### **2. macOS**

1. **Using Homebrew (Recommended):**
   - Install Homebrew if not already installed:
     ```bash
     /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
     ```
   - Install Git using Homebrew:
     ```bash
     brew install git
     ```

2. **Alternative: Install via Xcode Command Line Tools:**
   - Open Terminal and run:
     ```bash
     xcode-select --install
     ```
   - Follow the on-screen prompts to install Git.

3. **Verify Installation:**
   - Open Terminal and run:
     ```bash
     git --version
     ```
   - You should see the installed Git version.

---

### **3. Linux**

1. **Using Package Managers:**
   - For **Debian/Ubuntu**:
     ```bash
     sudo apt update
     sudo apt install git
     ```
   - For **Fedora**:
     ```bash
     sudo dnf install git
     ```
   - For **CentOS/RHEL**:
     ```bash
     sudo yum install git
     ```
   - For **Arch Linux**:
     ```bash
     sudo pacman -S git
     ```

2. **Verify Installation:**
   - Open a terminal and run:
     ```bash
     git --version
     ```

---

### **4. General Post-Installation Steps**

1. **Configure Git User:**
   - Run these commands to set your name and email globally:
     ```bash
     git config --global user.name "Your Name"
     git config --global user.email "your.email@example.com"
     ```

2. **Optional: Set a Default Editor:**
   - To set `vim`, `nano`, or another editor for Git:
     ```bash
     git config --global core.editor "nano"
     ```

3. **Check Configuration:**
   - View your Git configuration:
     ```bash
     git config --list
     ```

To install `pnpm`, you can follow these steps:

### 1. **Using `npm`**
If you already have Node.js and `npm` installed, you can install `pnpm` globally with the following command:
```bash
npm install -g pnpm
```

### 2. **Using Corepack**
If you're using Node.js v16.13 or higher, `Corepack` comes pre-installed, which manages package managers like `pnpm`. You can enable `Corepack` and then use it to install `pnpm`:
```bash
corepack enable
corepack prepare pnpm@latest --activate
```

### 3. **Using a Script**
If you prefer to install it directly without `npm`, use the following shell script:
```bash
curl -fsSL https://get.pnpm.io/install.sh | sh -
```
This script downloads and installs `pnpm`.

### 4. **Verifying the Installation**
After installation, verify that `pnpm` is installed correctly by checking its version:
```bash
pnpm --version
```

### 5. **Alternative: Install via Homebrew (macOS/Linux)**
If you're on macOS or Linux and use Homebrew, you can install `pnpm` like this:
```bash
brew install pnpm
```

### Notes:
- If you're using Windows, you can follow the first or second method, or use [Scoop](https://scoop.sh/):
  ```bash
  scoop install pnpm
  ```
