import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import puppeteer from 'puppeteer';
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Load environment variables from .env file
dotenv.config();

const { Client, LocalAuth } = pkg;


const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const chat = model.startChat({
    history: [], // Start with an empty history
    generationConfig: {
        maxOutputTokens: 200,
    },
});

// Function to send a message to the chatbot
async function sendMessageToChatbot(message) {
    const response = await chat.sendMessage(message);
    return response.text;
}

// Initialize the WhatsApp client with LocalAuth for session persistence
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

    // Respond to the "!ping" command
    if (msg.body === '!ping') {
        await msg.reply('pong');
    }

    // Echo back any message prefixed with "!echo"
    if (msg.body.startsWith('!echo ')) {
        const replyText = msg.body.slice(6); // Extract the text after "!echo "
        await msg.reply(replyText);
    }

    // Send media info if the message has media
    if (msg.body === '!mediainfo' && msg.hasMedia) {
        const attachmentData = await msg.downloadMedia();
        await msg.reply(`
            *Media Info*
            MimeType: ${attachmentData.mimetype}
            Filename: ${attachmentData.filename || 'unknown'}
            Data Size: ${attachmentData.data.length} bytes
        `);
    }
});

// Handle authentication failures
client.on('auth_failure', (err) => {
    console.error('Authentication failed:', err);
});

// Handle client disconnection
client.on('disconnected', (reason) => {
    console.log('WhatsApp client disconnected:', reason);
    process.exit(); // Exit the process to restart the client
});

// Initialize the WhatsApp client
client.initialize();
