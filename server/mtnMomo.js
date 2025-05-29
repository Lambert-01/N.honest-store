const axios = require('axios');
const uuid = require('uuid').v4;

// 🌍 Sandbox or production base URL
const baseURL = 'https://sandbox.momodeveloper.mtn.com/collection/v1_0';

// 📌 Load MTN MoMo credentials from environment variables
require('dotenv').config();

const apiUser = process.env.MTN_API_USER;
const apiKey = process.env.MTN_API_KEY;
const subscriptionKey = process.env.MTN_SUBSCRIPTION_KEY;
const targetEnvironment = process.env.MTN_TARGET_ENVIRONMENT || 'sandbox'; // Default to sandbox

// Validate required environment variables
if (!apiUser || !apiKey || !subscriptionKey) {
  throw new Error('Missing required MTN MoMo credentials in .env file');
}

// 1️⃣ Generate OAuth2 Access Token
async function getAccessToken() {
  try {
    const credentials = Buffer.from(`${apiUser}:${apiKey}`).toString('base64');

    const response = await axios.post(
      'https://sandbox.momodeveloper.mtn.com/collection/token/',
      {},
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Ocp-Apim-Subscription-Key': subscriptionKey,
        },
      }
    );

    return response.data.access_token;
  } catch (error) {
    console.error('Failed to generate access token:', error.response?.data || error.message);
    throw new Error('Failed to generate MTN MoMo access token');
  }
}

// 2️⃣ Initiate a "Request to Pay"
async function requestToPay(phoneNumber, amount, currency = 'RWF') {
  try {
    const token = await getAccessToken();
    const referenceId = uuid();

    await axios.post(
      `${baseURL}/requesttopay`,
      {
        amount: amount.toString(),
        currency,
        externalId: referenceId,
        payer: {
          partyIdType: 'MSISDN',
          partyId: phoneNumber, // Customer's phone number (payer)
        },
        payee: {
          partyIdType: 'MSISDN',
          partyId: '250790311401', // Shop owner's phone number (payee)
        },
        payerMessage: 'Payment for N.Honest order',
        payeeNote: 'Thank you for shopping!',
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Reference-Id': referenceId,
          'X-Target-Environment': targetEnvironment,
          'Ocp-Apim-Subscription-Key': subscriptionKey,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`Payment request sent successfully. Reference ID: ${referenceId}`);
    return referenceId;
  } catch (error) {
    console.error('Failed to send payment request:', error.response?.data || error.message);
    throw new Error('Failed to initiate MTN MoMo payment request');
  }
}

// 3️⃣ Check Payment Status
async function checkPaymentStatus(referenceId) {
  try {
    const token = await getAccessToken();

    const response = await axios.get(
      `${baseURL}/requesttopay/${referenceId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Target-Environment': targetEnvironment,
          'Ocp-Apim-Subscription-Key': subscriptionKey,
        },
      }
    );

    console.log(`Payment status checked. Reference ID: ${referenceId}, Status: ${response.data.status}`);
    return response.data; // Contains: amount, currency, status, reason, etc.
  } catch (error) {
    console.error('Failed to check payment status:', error.response?.data || error.message);
    throw new Error('Failed to check MTN MoMo payment status');
  }
}

module.exports = {
  requestToPay,
  checkPaymentStatus,
};