# Yuno Full Checkout Demo — HEG

A minimal demo of the [Yuno](https://y.uno) Full Checkout SDK integration with a card-country surcharge flow.

## What it does

- Renders the Yuno Full Checkout widget
- Detects when a card payment method is selected and shows a surcharge notice
- On payment submission, reads the card's country of origin from the SDK token
- Shows a confirmation modal with the applicable surcharge before charging:
  - **1%** for Singapore-issued cards
  - **2%** for all other cards
- Cancelling the modal reopens the card form; confirming submits the payment

## Stack

Vanilla JS + Node.js / Express

## Setup

1. Clone the repo
2. Copy the sample env file and fill in your credentials:
   ```bash
   cp .env.example .env
   ```
3. Install dependencies and start:
   ```bash
   npm install && npm start
   ```
4. Open [http://localhost:8080](http://localhost:8080)

## Environment variables

| Variable | Description |
|---|---|
| `ACCOUNT_CODE` | Your Yuno account code |
| `PUBLIC_API_KEY` | Your Yuno public API key |
| `PRIVATE_SECRET_KEY` | Your Yuno private secret key |
