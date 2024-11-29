import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Load environment variables from .env file
dotenv.config();

const { Client, LocalAuth } = pkg;

// Error handling function (optional)
function handleError(err) {
  console.error('Error:', err);
  // Add more robust error handling here (e.g., retry logic, user notifications)
}

// Function to load synthetic data
function loadSyntheticData() {
  try {
    return fs.readFileSync('synthetic_data.txt', 'utf-8');
  } catch (error) {
    handleError(error);
    return ''; // Handle empty data gracefully
  }
}

// Function to initialize the generative AI model
function initializeGenerativeAI() {
  const genAI = new GoogleGenerativeAI(process.env.API_KEY);
  return genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
}

// Function to create a chat session
function createChat(model) {
  return model.startChat({
    history: [], // Start with an empty history
    generationConfig: {
      maxOutputTokens: 200,
    },
  });
}


async function main() {
  const syntheticData = loadSyntheticData();
  const model = initializeGenerativeAI();
  const chat = createChat(model);

  const client = new Client({
    authStrategy: new LocalAuth(), // Automatically saves the session in .wwebjs_auth/
    puppeteer: {
      executablePath: puppeteer.executablePath(), // Use Puppeteer installed in your project
      headless: true, // Run browser in headless mode
      args: ['--no-sandbox', '--disable-setuid-sandbox'], // For environments with limited sandboxing support
  },
  });

  // Listen for QR code generation and display it in the terminal
  client.on('qr', (qr) => {
    console.log('Scan this QR code with your WhatsApp to log in:');
    qrcode.generate(qr, { small: true });
  });

  // Log a message when authenticated
  client.on('authenticated', () => {
    console.log('WhatsApp client authenticated!');
  });

  // Handle client ready state
  client.on('ready', () => {
    console.log('WhatsApp client is ready to send and receive messages!');
  });

  // Handle incoming messages
  client.on('message', async (msg) => {
    console.log(`Received message from ${msg.from}: ${msg.body}`);

    const handleUserMessage = async (message) => {
      if (message === '!ping') {
        return 'pong';
      } else if (message.startsWith('!echo ')) {
        return message.slice(6); // Extract the text after "!echo "
      } else if (message === '!mediainfo' && msg.hasMedia) {
        const attachmentData = await msg.downloadMedia();
        return `
          *Media Info*
          MimeType: ${attachmentData.mimetype}
          Filename: ${attachmentData.filename || 'unknown'}
          Data Size: ${attachmentData.data.length} bytes
        `;
      } else {
        const responseText = await sendMessageToChatbot(message);
        return responseText;
      }
    };

    const replyText = await handleUserMessage(msg.body);
    if (replyText) {
      await msg.reply(replyText);
    }
  });

  // Handle authentication failures
  client.on('auth_failure', handleError);

  // Handle client disconnection
  client.on('disconnected', (reason) => {
    console.log('WhatsApp client disconnected:', reason);
    process.exit(); // Exit the process to restart the client
  });

  async function sendMessageToChatbot(message) {
    const context = new Document({ content: syntheticData });
    const response = await chat.sendMessage(message, { context });
    return response.text;
  }

  // Initialize the WhatsApp client
  client.initialize();
}

main();