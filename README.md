# Study Sets - BeachHacks 8.0

A Next.js application for quiz generation and subject management using AI.

## Authors

[Lucas Amberg](https://github.com/lucas-amberg) and [Tylor Franca](https://github.com/tylorrfranca)

## Results

**Winner!**

Study Sets took home 1st place in the Beginner Track and 2nd place in the DAIN AI track.

Thank you so much for all organizers for setting up and carrying out this event, we really appreciate all the effort, mentorship, and support from the organizers and other competitors.

You can view our submission on Devpost [here](https://devpost.com/software/study-sets?_gl=1*x3z1sg*_gcl_au*MTk1NDU3NzEzLjE3NDI2NjE3MzI.*_ga*MjAzNzE4NTg5LjE3NDI2NjE3MzI.*_ga_0YHJK3Y10M*MTc0MzcyNDg1Ny44LjEuMTc0MzcyNDg3OS4wLjAuMA..)!

## Description

This application allows users to generate quizzes from different study material across various categories and subjects, leveraging AI to create content and categorize educational topics.

## Technologies and Libraries Used

### Core Framework and Runtime

- [Next.js](https://nextjs.org/) - React framework with server-side rendering and static site generation
- [React](https://react.dev/) - JavaScript library for building user interfaces

### Database and Authentication

- [Supabase](https://supabase.com/) - Open source Firebase alternative providing database and authentication services

### AI and Machine Learning

- [OpenAI](https://openai.com/) - AI model integration for quiz generation and subject categorization

### UI Components and Styling

- [Radix UI](https://www.radix-ui.com/) - Headless UI component primitives
    - Including: Accordion, Alert Dialog, Aspect Ratio, Avatar, Checkbox, Collapsible, Context Menu, Dialog, Dropdown Menu, Hover Card, Label, Menubar, Navigation Menu, Popover, Progress, Radio Group, Scroll Area, Select, Separator, Slider, Slot, Switch, Tabs, Toggle, Toggle Group, Tooltip
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
    - With [tailwind-merge](https://github.com/dcastil/tailwind-merge) and [tailwindcss-animate](https://github.com/jamiebuilds/tailwindcss-animate)
- [Lucide React](https://lucide.dev/) - Icon library
- [Framer Motion](https://www.framer.com/motion/) - Animation library
- [Sonner](https://github.com/emilkowalski/sonner) - Toast notifications
- [Next Themes](https://github.com/pacocoursey/next-themes) - Theme management
- [cmdk](https://github.com/pacocoursey/cmdk) - Command menu component
- [PrimeReact](https://primereact.org/) - UI component library with [PrimeIcons](https://primereact.org/icons/)
- [Vaul](https://github.com/emilkowalski/vaul) - Drawer component
- [Embla Carousel](https://www.embla-carousel.com/) - Carousel component
- [React Confetti](https://github.com/alampros/react-confetti) - Confetti animation
- [React Day Picker](https://react-day-picker.js.org/) - Date picker component
- [React Resizable Panels](https://github.com/bvaughn/react-resizable-panels) - Resizable panels

### Form Handling and Validation

- [React Hook Form](https://react-hook-form.com/) - Form handling
- [Zod](https://zod.dev/) - TypeScript-first schema validation
- [Hookform Resolvers](https://github.com/react-hook-form/resolvers) - Validation resolvers for React Hook Form
- [input-otp](https://github.com/guilherme-teixeira/input-otp) - One-time password input component

### Data Processing and Visualization

- [PDF.js](https://mozilla.github.io/pdf.js/) - PDF rendering
- [React PDF](https://github.com/wojtekmaj/react-pdf) - PDF viewer component
- [libreoffice-convert](https://github.com/elwerene/libreoffice-convert) - Document conversion
- [date-fns](https://date-fns.org/) - Date manipulation
- [Recharts](https://recharts.org/) - Charting library
- [UUID](https://github.com/uuidjs/uuid) - UUID generation
- [heic2any](https://github.com/alexcorvi/heic2any) - HEIC image conversion
- [Canvas](https://github.com/Automattic/node-canvas) - Node.js canvas implementation

### File Handling

- [React Dropzone](https://github.com/react-dropzone/react-dropzone) - File upload component

### HTTP Requests

- [Axios](https://axios-http.com/) - Promise-based HTTP client

### Developer Tools

- [TypeScript](https://www.typescriptlang.org/) - JavaScript with syntax for types
- [ESLint](https://eslint.org/) - JavaScript linter
- [Prettier](https://prettier.io/) - Code formatter

## Installation

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

## Environment Variables

This project requires the following environment variables:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
OPENAI_API_KEY=your_openai_api_key
```

## License

This project is private and not intended for redistribution.
