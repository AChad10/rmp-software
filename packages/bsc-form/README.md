# BSC Submission Form - Red Mat Pilates

React application for trainer self-assessment (Balanced Score Card) submission.

## Features

- 📊 Dynamic form generation based on trainer's scorecard template
- 🎚️ Interactive sliders for self-scoring
- 📈 Real-time weighted score calculation
- ✅ Submission validation and success feedback
- 📱 Fully responsive design
- 🎨 Beautiful gradient UI

## Development

### Setup

```bash
npm install
```

### Environment Variables

Create a `.env` file:

```env
VITE_API_URL=http://localhost:3000/api
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Build for Production

```bash
npm run build
```

The build output will be in the `dist/` directory.

## URL Structure

### Trainer Assessment Form
```
/:trainerId
/:trainerId/:quarter
```

Examples:
- `/507f1f77bcf86cd799439011` - Current quarter assessment
- `/507f1f77bcf86cd799439011/2026-Q1` - Specific quarter

### Success Page
```
/success?quarter=2026-Q1
```

## Components

### BSCForm
Main form component that:
- Fetches trainer data from API
- Displays Power BI dashboard (placeholder for now)
- Generates dynamic metric sliders
- Calculates weighted score in real-time
- Submits assessment to backend

### Success
Confirmation page shown after successful submission.

## API Integration

Connects to backend API endpoints:
- `GET /api/trainers/:id` - Fetch trainer details
- `GET /api/bsc/trainer/:trainerId` - Check existing submissions
- `POST /api/bsc/submit` - Submit BSC assessment

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import repository in Vercel
3. Set environment variable:
   - `VITE_API_URL=https://your-backend-url.com/api`
4. Deploy

Custom domain: `bsc.redmat.com`

### Manual Deployment

```bash
npm run build
```

Upload `dist/` folder to any static hosting service (Netlify, GitHub Pages, etc.)

## Power BI Integration

The form includes a placeholder for Power BI dashboard embedding. To enable:

1. Get your Power BI embed URL from Microsoft
2. Update the iframe src in `BSCForm.tsx`:

```tsx
<iframe
  src={`YOUR_POWER_BI_URL?filter=trainer eq '${trainerId}'`}
  width="100%"
  height="400"
  frameBorder="0"
  title="Performance Dashboard"
></iframe>
```

If embedding doesn't work due to CORS, use a link instead:

```tsx
<a href={powerBiUrl} target="_blank" rel="noopener noreferrer">
  Open Your Dashboard →
</a>
```

## Customization

### Colors
Update gradient colors in CSS files:
- Primary gradient: `#667eea` to `#764ba2`
- Success gradient: `#10b981` to `#059669`

### Logo
Place your logo at `/public/logo.png` (it will auto-load in the header)

## Browser Support

- Chrome, Firefox, Safari, Edge (latest versions)
- Mobile browsers (iOS Safari, Chrome Mobile)
