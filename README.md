# Rakuten URLs Testing

Automated testing suite for Rakuten affiliate URL redirections using Playwright.

## Features

- **Automated Sign-in**: Handles Rakuten authentication with reCAPTCHA
- **Batch URL Testing**: Tests multiple store URLs from Excel file
- **Screenshot Capture**: Takes screenshots at key points for debugging
- **Shared Session**: Uses single browser session for all tests
- **CI/CD Integration**: GitHub Actions workflows for automated testing

## Local Development

### Prerequisites

- Node.js (LTS version)
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/tarunramireddy/rakuten-urls.git
cd rakuten-urls

# Install dependencies
npm install

# Install Playwright browsers
npm run install:browsers
```

### Running Tests

```bash
# Run all tests
npm test

# Run shopping tests specifically
npm run test:shopping

# Run redirection tests
npm run test:redirection

# Run tests with browser visible (headed mode)
npm run test:headed

# Debug tests
npm run test:debug

# View test report
npm run test:report
```

## Excel File Format

The `shopping_trip_redirection.xlsx` file should contain:

| store_id | store_name | xfas_url | merchant_site_url | network_id |
|----------|------------|----------|-------------------|------------|
| 1        | Example Store | https://... | https://... | 123 |

## GitHub Actions Workflows

### 1. General Playwright Tests (`playwright.yml`)
- Runs on: Push to main/master, PRs, daily at 2 AM UTC
- Runs all Playwright tests
- Uploads test results and reports

### 2. Shopping Trip Tests (`shopping-tests.yml`)
- Runs on: Changes to shopping tests or Excel file
- Runs twice daily (9 AM and 6 PM UTC)
- Manual trigger available
- Uploads screenshots and detailed reports

### Manual Workflow Trigger

1. Go to your repository on GitHub
2. Click "Actions" tab
3. Select "Shopping Trip Tests"
4. Click "Run workflow"
5. Choose which test file to run

## Test Configuration

### Environment Variables (Optional)
- `HEADLESS`: Set to `false` for headed mode (default: `true` in CI)

### Timeouts
- Individual test timeout: 70 seconds
- Page load timeout: 5 seconds with fallback screenshots
- Redirect waiting: Up to 45 seconds

## Troubleshooting

### Common Issues

1. **reCAPTCHA Issues**: Tests include automatic reCAPTCHA handling with delays
2. **Page Load Timeouts**: Fallback screenshots are taken for debugging
3. **Session Persistence**: Shared browser context maintains login across tests

### Viewing Results

- Test reports are available in GitHub Actions artifacts
- Screenshots are captured for both successful and failed tests
- Detailed logs show redirect chains and timing information

## Contributing

1. Make changes to test files
2. Test locally: `npm run test:shopping`
3. Commit and push to trigger CI/CD pipeline
4. View results in GitHub Actions