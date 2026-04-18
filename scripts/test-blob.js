/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Diagnostic script to test Vercel Blob storage connectivity.
 * Run with: node scripts/test-blob.js
 */
const { put } = require('@vercel/blob');
const fs = require('fs');
const path = require('path');

// Basic .env.local loader
const envLocalPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value;
    }
  });
}

async function testBlob() {
  console.log("--- Vercel Blob Diagnostic ---");
  
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error("❌ ERROR: BLOB_READ_WRITE_TOKEN is not defined in .env.local");
    console.log("Please ensure you have added the token from your Vercel Dashboard.");
    return;
  }

  console.log("Found BLOB_READ_WRITE_TOKEN. Attempting test upload...");

  try {
    const testContent = "Hello from VisionFX Diagnostic Script!";
    const fileName = `diagnostic_${Date.now()}.txt`;
    
    console.log(`Uploading ${fileName}...`);
    
    const blob = await put(`diagnostics/${fileName}`, testContent, {
      access: 'private',
      contentType: 'text/plain',
    });

    console.log("✅ SUCCESS! Blob uploaded successfully.");
    console.log(`URL: ${blob.url}`);
    console.log("Your Vercel Blob configuration is correct.");
  } catch (error) {
    console.error("❌ FAILED: Error uploading to Vercel Blob.");
    console.error("Error details:", error.message || error);
    
    if (error.message.includes("401")) {
      console.log("\nSuggestion: Your token might be invalid or expired.");
    } else if (error.message.includes("fetch")) {
      console.log("\nSuggestion: Check your internet connection.");
    }
  }
}

testBlob();
