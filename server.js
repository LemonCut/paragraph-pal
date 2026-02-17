require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const textToSpeech = require('@google-cloud/text-to-speech');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Google Generative AI client
const client = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Initialize Google Cloud Text-to-Speech client
const ttsClient = new textToSpeech.TextToSpeechClient();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Text-to-Speech endpoint
app.post('/api/synthesize-speech', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid text parameter' });
    }

    const request = {
      input: { text },
      voice: { 
        languageCode: 'en-US',
        name: 'en-US-Standard-C'
      },
      audioConfig: { audioEncoding: 'MP3' }
    };

    const [response] = await ttsClient.synthesizeSpeech(request);
    const audioContent = response.audioContent;

    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(audioContent);
  } catch (error) {
    console.error('Error synthesizing speech:', error);
    res.status(500).json({ 
      error: 'Failed to synthesize speech',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Generate sentences endpoint (topic or concluding)
app.post('/api/generate-sentences', async (req, res) => {
  try {
    const { type, topic, details, topicSentence } = req.body;

    // Validate inputs
    if (!type || !['topic', 'concluding'].includes(type)) {
      return res.status(400).json({ error: 'Invalid or missing type parameter' });
    }
    if (!topic || !details || !Array.isArray(details)) {
      return res.status(400).json({ error: 'Missing or invalid topic/details' });
    }

    const detailText = details.map((d, i) => `Detail ${i + 1}: ${d}`).join('\n');

    let userMsg;
    if (type === 'topic') {
      userMsg = `A 4th grade student is writing a paragraph about: "${topic}"

Their 3 detail sentences are:
${detailText}

Write exactly 3 different topic sentences that:
- Specifically name or reference "${topic}" — never write a generic sentence
- Introduce what all 3 details are about
- Use simple 4th grade words, 8-16 words each
- Each starts differently
- Sound friendly and age-appropriate
- Try to match the writing voice of the student

Return ONLY a JSON array of 3 strings, no explanation, no markdown.`;
    } else {
      if (!topicSentence) {
        return res.status(400).json({ error: 'topicSentence required for concluding type' });
      }

      userMsg = `A 4th grade student wrote a paragraph about: "${topic}"

Their topic sentence is: "${topicSentence}"

Their 3 detail sentences are:
${detailText}

Write exactly 3 different concluding sentences that:
- Specifically reference "${topic}" — never write a generic sentence
- Restate the main idea in a new way without adding new information
- Use simple 4th grade words, 8-16 words each
- Each starts differently
- Try to match the writing voice of the student
- Sound warm and final, like a closing hug for the paragraph

Return ONLY a JSON array of 3 strings, no explanation, no markdown.`;
    }

    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const response = await model.generateContent(userMsg);

    const raw = response.response.text() || '[]';
    const sentences = JSON.parse(raw.replace(/```json|```/g, '').trim());

    res.json({ success: true, sentences });
  } catch (error) {
    console.error('Error generating sentences:', error);
    res.status(500).json({ 
      error: 'Failed to generate sentences',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Serve the main app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle 404s by serving the app (for client-side routing if needed)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Paragraph Pal server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
