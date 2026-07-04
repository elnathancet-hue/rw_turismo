# RW Turismo

RW Turismo é uma plataforma de pacotes, experiências e reservas construída com Next.js
and TypeScript on the front-end, with Supabase Auth, Supabase PostgreSQL and
Stripe for the internal booking/payment flow.

- Implemented OAuth for user authentication and Hotels API for retrieving hotel data. 
- Utilized Stripe Payments and Webhooks for handling payment transactions and keep a customer booking history. 
- Styled the application with Tailwind CSS and integrated MapBox for displaying hotel locations. 
- This project allowed me to gain experience with modern web development technologies and practices such as serverless architecture and third-party API integration.

![smartmockups_lb4dtxsx](https://user-images.githubusercontent.com/42308135/204942042-fe23854f-d8ed-42bc-b234-0132af974e68.jpg)

🔗 [Open live Demo](https://travel-nextjs-typescript-tailwind-mapbox-calendar-date-picker.vercel.app/)

## Tech Stack

- Next.js
- React.js
- TypeScript
- Tailwind CSS
- Supabase
- CockroachDB (Uses PostgreSQL wire protocol 3.0)
- Supabase Auth
- Google OAuth
- Hotels API
- Stripe Checkout
- Webhooks
- MapBox

## Features

- Responsive UI with Tailwind CSS.
- Hotels search via Hotels API
- Hotel map location with MapBox.
- Payment Checkout flow with Stripe
- Customer Booking History
- Data fetching and caching techniques using SSR (Server Side Rendering) with Next.js.
- User authentication with Supabase Auth and Google OAuth.
- Robust code using TypeScript.

## Screen Captures

<img src="https://user-images.githubusercontent.com/42308135/204944413-e1cc740e-8b1d-4276-b8b5-cb23e011bfff.gif" width="750" />
<img src="https://user-images.githubusercontent.com/42308135/204948039-9335d231-c6d6-4bb2-9fed-91ab9ceada11.gif" width="750" />

## Screenshots

<img src="https://user-images.githubusercontent.com/42308135/204951529-267242eb-2f9c-48d0-bce3-4926d7c191df.png" width="750" />
<img src="https://user-images.githubusercontent.com/42308135/204953659-b5fe0682-bd44-464e-a49a-28525075e6cc.png" width="600" />
<img src="https://user-images.githubusercontent.com/42308135/204951745-aa84d9ae-2118-484e-b777-d400a6768c02.png" width="600" />
<img src="https://user-images.githubusercontent.com/42308135/204952050-6b6dcc19-a317-47a4-b8f0-fe73333e2c58.png" width="600" />
<img src="https://user-images.githubusercontent.com/42308135/204952287-697be151-694f-4db7-99b3-008d28c668e7.png" width="600" />
<img src="https://user-images.githubusercontent.com/42308135/204952752-fbfa67a8-bbba-47ce-ba24-f491f4cedd78.png" width="600" />

## Installation

First, clone the project and open it with Visual Studio Code:

```bash
git clone https://github.com/javigong/travel-nextjs-typescript-tailwind-mapbox-calendar-date-picker.git

cd travel-nextjs-typescript-tailwind-mapbox-calendar-date-picker

code .
```

Then, create a .env.local file in the root of the project and configure the following environment variables:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Public site URL
NEXT_PUBLIC_SITE_URL=

# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=

# RapidAPI, Hotels API
RAPIDAPI_KEY=

# Firebase client
FIREBASE_CLIENT_API_KEY=
FIREBASE_CLIENT_AUTH_DOMAIN=
FIREBASE_CLIENT_PROJECT_ID=
FIREBASE_CLIENT_STORAGE_BUCKET=
FIREBASE_CLIENT_MESSAGING_SENDER_ID=
FIREBASE_CLIENT_APP_ID=

# Authentication
# Google OAuth is configured in Supabase Auth.

# Stripe Payments
# More info: https://stripe.com/docs/payments/accept-a-payment
STRIPE_SECRET_KEY=

# Stripe Terminal/CLI
STRIPE_INTERNAL_WEBHOOK_SECRET=
```

Use `NEXT_PUBLIC_SITE_URL=http://localhost:3000` localmente e
`NEXT_PUBLIC_SITE_URL=https://travel-nextjs-typescript-tailwind-m.vercel.app`
na producao. Cadastre no Supabase os redirects `/auth/callback` e
`/reset-password` para os dois ambientes.

Required production variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_INTERNAL_WEBHOOK_SECRET`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_MAPBOX_TOKEN`
- `RAPIDAPI_KEY`

Final routes:

Public:

- `/`
- `/products/[slug]`
- `/search`
- `/details`
- `/signin`
- `/auth/callback`

Customer:

- `/account/bookings`
- `/account/bookings/[id]`
- `/favorites`

Admin:

- `/admin`
- `/admin/products`
- `/admin/product-dates`
- `/admin/categories`
- `/admin/bookings`
- `/admin/payments`

Internal APIs:

- `/api/bookings/create-pending`
- `/api/bookings/expire`
- `/api/payments/create-checkout-session`
- `/api/payments/webhook`
- `/api/rapidapi/city-suggestions`

To send Stripe events to a local webhook install Stripe CLI, login into your Stripe account, and use the --forward-to flag pointing to the webhook endpoint, and create a trigger for successful customer payments :

```bash
brew install stripe/stripe-cli/stripe

stripe login

stripe listen --forward-to localhost:3000/api/payments/webhook

stripe trigger checkout.session.completed
```

Finally, install the npm dependencies and run the application:

```bash
npm install

npm run dev
```

Now the application is running on http://localhost:3000 🚀

## How to test Stripe Checkout

The current Stripe Checkout implementation simulates payments in test mode. 

⛔️ Please, do not use real card details. Use the following test card details:

* Use a card number, such as 4242 4242 4242 4242. Enter the card number in the Dashboard or in any payment form.
* Use a valid future date, such as 12/34.
* Use any three-digit CVC (four digits for American Express cards).
* Use any value you like for other form fields.

![Testing form with test card number 4242 4242 4242 4242](https://b.stripecdn.com/docs-statics-srv/assets/test-card.c3f9b3d1a3e8caca3c9f4c9c481fd49c.jpg)

## Deployment details

RW Turismo na Vercel:

[Deployment Activity Log](https://github.com/javigong/travel-nextjs-typescript-tailwind-mapbox-calendar-date-picker/deployments/activity_log?environment=Production)
