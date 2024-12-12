// src/index.ts
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { marked } from 'marked'; // Import marked for Markdown parsing

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001; // Changed default port to 5001 to avoid conflict

// Middleware
app.use(cors());
app.use(express.json());

// Security Middleware
app.use(helmet());

// Rate Limiting Middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes.',
});
app.use(limiter);

// Configure Multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Initialize OpenAI with the new API syntax
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // This is the default and can be omitted
});

// Helper function to load and parse Markdown files
const loadMarkdownFile = async (filePath: string): Promise<string> => {
  try {
    const markdownContent = await fs.readFile(filePath, 'utf-8');
    // Convert Markdown to plain text
    const plainText = marked.parse(markdownContent, { renderer: new marked.Renderer() }) as string;
    // Remove any HTML tags generated by marked
    const regex = /<[^>]+>/g;
    return plainText.replace(regex, '');
  } catch (error) {
    console.error(`Error reading file at ${filePath}:`, error);
    return '';
  }
};

// Load context files and create system prompt
const loadSystemPrompt = async (): Promise<string> => {
  const contextPath = path.join(__dirname, '..', 'config', 'context.md');
  const personaPath = path.join(__dirname, '..', 'config', 'fee-persona.md');

  const contextContent = await loadMarkdownFile(contextPath);
  const personaContent = await loadMarkdownFile(personaPath);

  // Optionally, summarize the content to manage token usage
  const summarizedContext = `
    SESMag Reviews evaluate how socio-economic status (SES) factors influence user interactions with technology. Key personas include Low SES Users like Dav and Higher SES Users, each characterized by factors such as Access to Reliable Tech, Technology Self-Efficacy, Communication Literacy, Privacy Concerns, Attitudes toward Tech Risks, and Perceived Control.
  `;

  const summarizedPersona = `
    Fee is a 30-year-old Accountant from Richmond, Virginia, with high access to reliable technology, high technology self-efficacy, comfortable with taking technology risks, and views technology as a controllable tool. Fee enjoys learning and using new technologies and has high communication literacy.
  `;

  // Combine the summaries to form the system prompt
  const systemPrompt = `
${summarizedContext}

${summarizedPersona}

You are Fee, a knowledgeable and insightful reviewer for SESMag. You provide thoughtful analyses and reviews based on the provided documents and your extensive understanding of SESMag.
  `;

  return systemPrompt;
};

// Load the system prompt before handling any requests
let systemPrompt = '';

const initializeSystemPrompt = async () => {
  systemPrompt = await loadSystemPrompt();
  if (!systemPrompt) {
    console.error('Failed to load system prompt. Exiting...');
    process.exit(1);
  }
};

// Initialize system prompt
initializeSystemPrompt();

// Helper function to extract text from PDF
const extractTextFromPDF = async (filePath: string): Promise<string> => {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error(`Error parsing PDF at ${filePath}:`, error);
    return '';
  }
};

// Route to handle chat messages and optional PDF uploads
app.post('/api/chat', upload.single('file'), async (req, res) => {
  try {
    const userMessage: string = req.body.message || '';
    let pdfText = '';

    if (req.file) {
      pdfText = await extractTextFromPDF(req.file.path);
      // Optionally, delete the file after processing
      await fs.unlink(req.file.path);
    }

    // Combine user message and PDF text if available
    let userInput = userMessage;
    if (pdfText) {
      userInput += `\n\nHere is a document for your review:\n${pdfText}`;
    }

    // Create chat completion using the new API syntax
    const { data: chatCompletion, response: apiResponse } = await openai.chat.completions.create({
      model: 'gpt-4o', // Use the desired model
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput },
      ],
      max_tokens: 1500,
      temperature: 0.7,
    }).withResponse(); // To access response headers

    // Ensure that chatCompletion.choices[0].message exists
    const aiMessage = chatCompletion.choices[0]?.message?.content?.trim() || 'Sorry, I couldn\'t generate a response.';

    // Example of accessing headers
    const remainingTokens = apiResponse.headers.get('x-ratelimit-remaining-tokens');
    console.log(`Remaining Tokens: ${remainingTokens}`);

    res.json({ message: aiMessage });
  } catch (error: any) {
    console.error(error);
    if (error instanceof OpenAI.APIError) {
      // Handle API errors
      console.error(`Error Status: ${error.status}`);
      console.error(`Error Message: ${error.message}`);
      console.error(`Error Code: ${error.code}`);
      console.error(`Error Type: ${error.type}`);
      res.status(error.status || 500).json({ error: error.message });
    } else {
      // Handle non-API errors
      res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});