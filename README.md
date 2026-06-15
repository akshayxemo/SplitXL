# SplitXL

A modern, feature-rich expense tracker and group expense splitter built as a Progressive Web App (PWA). SplitXL helps you track personal expenses, manage group spending, and simplify debt settlements with an intuitive interface and powerful analytics.

![SplitXL](https://img.shields.io/badge/SplitXL-Expense%20Tracker-purple)
![React](https://img.shields.io/badge/React-19.2-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue)
![License](https://img.shields.io/badge/License-MIT-green)


## ✨ Features

### Personal Expense Tracking
- Track daily expenses with categories, notes, and dates
- Set and monitor personal budgets
- Visual spending analytics with interactive charts
- Category-based expense breakdown
- Monthly and yearly spending trends

### Group Expense Splitting
- Create expense groups for trips, shared households, or events
- Add group members with contact information
- Multiple split methods:
  - **Equal Split**: Divide evenly among all or selected members
  - **Manual Split**: Specify exact amounts for each member
  - **Percentage Split**: Allocate by percentage
- Link friends to group members for easy management
- Group budgets with utilization tracking

### Settlement System
- Automatic debt calculation and simplification
- Track who owes whom with minimal transactions
- Settlement progress tracking
- Record settlement payments
- Group lifecycle management (active → settlement in progress → settled → archived)

### Data Management
- Export/import data with integrity validation
- PDF report generation for personal and group expenses
- Local IndexedDB storage with migration support
- Offline-first architecture with PWA support

### User Experience
- Dark/Light/System theme support
- Responsive design for mobile and desktop
- Installable as a Progressive Web App
- Fast, intuitive interface with smooth animations

## 🚀 Tech Stack

- **Frontend**: React 19.2 with TypeScript
- **Build Tool**: Vite 8.0
- **Styling**: TailwindCSS v4 with shadcn/ui components
- **State Management**: Zustand
- **Database**: IndexedDB via Dexie
- **Routing**: React Router DOM
- **Charts**: Recharts
- **PDF Generation**: @react-pdf/renderer
- **Validation**: Zod
- **Date Handling**: date-fns
- **Icons**: Lucide React
- **PWA**: vite-plugin-pwa with Workbox

## 📁 Project Structure

```
SplitXL/
├── src/
│   ├── app/              # App components and routing
│   ├── components/       # Reusable UI components
│   ├── features/         # Feature modules (expenses, groups, friends, etc.)
│   ├── lib/              # Core utilities and database logic
│   ├── stores/           # Zustand state management
│   └── assets/           # Static assets
├── public/               # Public assets and PWA icons
├── docs/                 # Documentation
└── tests/                # Test files
```

### Key Modules

- **`lib/db.ts`**: IndexedDB schema and database operations with migration support
- **`lib/settlement.ts`**: Debt calculation and simplification algorithms
- **`lib/export-import.ts`**: Data export/import with validation
- **`features/dashboard/`**: Analytics and spending insights
- **`features/groups/`**: Group management and expense splitting
- **`features/reports/`**: PDF report generation

## 🛠️ Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/SplitXL.git
cd SplitXL

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📱 PWA Installation

SplitXL can be installed as a Progressive Web App on supported devices:

1. Open the app in a supported browser (Chrome, Edge, Safari)
2. Click the install icon in the address bar
3. Follow the prompts to add to your home screen

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## 🗄️ Database Schema

The app uses IndexedDB with the following main entities:

- **Accounts**: User accounts with contact information
- **Friends**: Contact management for group members
- **Categories**: Expense categorization with custom icons
- **PersonalExpenses**: Individual expense tracking
- **Groups**: Expense groups with budgets and lifecycle states
- **GroupMembers**: Group participant management
- **Transactions**: All group transactions (expenses, refunds, settlements)
- **Settings**: App configuration and preferences

The database supports schema migrations (currently at version 5) for seamless upgrades.

## 🔒 Privacy & Security

- All data is stored locally on your device
- No cloud sync or external data transmission
- Device-based authentication
- Export functionality for data backup

## 📊 Algorithms

### Debt Simplification
SplitXL uses a greedy algorithm to minimize the number of settlement transactions:

1. Calculate net balances for all members
2. Separate creditors (positive balance) and debtors (negative balance)
3. Match largest debts with largest credits
4. Generate minimal settlement transactions

### Split Methods
- **Equal All**: Amount divided by active members with remainder distribution
- **Equal Selected**: Amount divided by selected members
- **Manual**: User-defined exact amounts
- **Percentage**: User-defined percentage allocation with rounding

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Vite](https://vitejs.dev/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons by [Lucide](https://lucide.dev/)
- Charts powered by [Recharts](https://recharts.org/)

## 📧 Contact

For questions or feedback, please open an issue on GitHub.
