import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';  // LangChain for OpenAI embeddings
import { PineconeClient } from 'pinecone-client';  // Pinecone for vector store
import { Document } from 'langchain/document'; // LangChain document handling
import fs from 'fs'; // To read the synthetic data text file

// Load environment variables from .env file
dotenv.config();

const { Client, LocalAuth } = pkg;

const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Initialize the WhatsApp client with LocalAuth for session persistence
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: puppeteer.executablePath(),
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
});

// Function to load synthetic data from file
function loadSyntheticData(filePath) {
    const data = fs.readFileSync(filePath, 'utf-8');
    return data.split('\n').filter(line => line.trim() !== '');  // Remove empty lines
}

// Load synthetic data from the file
const syntheticData = loadSyntheticData('synthetic_data.txt');

// Create LangChain OpenAIEmbeddings instance
const openAIEmbeddings = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY });

// Embed the synthetic data
async function embedData(data) {
    const documents = data.map((text) => new Document({ pageContent: text }));
    const embeddings = await openAIEmbeddings.embedDocuments(documents);
    return embeddings;
}

// Set up Pinecone for storing embeddings
const pineconeClient = new PineconeClient();
await pineconeClient.init({ apiKey: process.env.PINECONE_API_KEY, environment: 'us-east1-gcp' });
const pineconeIndex = pineconeClient.Index('stargan-knowledge');

// Store embeddings in Pinecone vector store
async function storeEmbeddings(embeddings) {
    const upsertResponse = await pineconeIndex.upsert({
        vectors: embeddings.map((embedding, idx) => ({
            id: `doc-${idx}`,
            values: embedding,
            metadata: { text: syntheticData[idx] },
        })),
    });
    return upsertResponse;
}

// Query the embeddings for a relevant response
async function handleChatQuery(query) {
    const queryEmbedding = await openAIEmbeddings.embedQuery(query);
    const results = await pineconeIndex.query({
        vector: queryEmbedding,
        topK: 3,  // Retrieve top 3 most relevant responses
    });
    return results.matches.map((match) => match.metadata.text).join("\n");
}

// Function to send a message to the chatbot using the Gemini model
async function sendMessageToChatbot(message) {
    const response =  model.startChat({
        history: [],
        generationConfig: {
            maxOutputTokens: 200,
        },
    });
    const reply = await response.sendMessage(message);
    return reply.text;
}

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

    // Query the chatbot using the embeddings stored in Pinecone
    const response = await handleChatQuery(msg.body);
    await msg.reply(response);
});

// Handle authentication failures
client.on('auth_failure', (err) => {
    console.error('Authentication failed:', err);
});

// Handle client disconnection
client.on('disconnected', (reason) => {
    console.log('WhatsApp client disconnected:', reason);
    process.exit();
});

// Initialize the WhatsApp client and embeddings
client.initialize();

// Embed and store synthetic data
embedData(syntheticData).then(storeEmbeddings);
