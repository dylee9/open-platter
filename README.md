# Open Platter

Open Platter is an open-source application that allows you to connect your Twitter account, schedule posts, and generate tweets from text transcriptions using Azure OpenAI. It's built with Next.js and uses a local SQLite database for storage.

## Features

*   **Twitter Integration**: Connect your Twitter account using OAuth 1.0a.
*   **Post Scheduling**: Schedule tweets to be posted at a future time.
*   **AI Tweet Generation**: Upload a text file (`.txt`) and use Azure OpenAI to generate a series of suggested tweets based on the content.
*   **Batch Scheduling**: Review, edit, and schedule the AI-generated tweets in bulk.
*   **Local Database**: Uses a local SQLite database, so you can run it without any external database dependencies.
*   **Cron Job**: A simple cron job script posts your scheduled tweets automatically.

## Getting Started

Follow these instructions to get the project up and running on your local machine.

### 1. Prerequisites

*   [Node.js](https://nodejs.org/) (v20.6.0 or later)
*   [npm](https://www.npmjs.com/)
*   A [Twitter Developer Account](https://developer.twitter.com/en/apply-for-access)
*   An [Azure Account](https://azure.microsoft.com/en-us/free/) with access to Azure OpenAI services.

### 2. Obtain Twitter Developer Keys

1.  **Apply for a Twitter Developer Account**: If you don't have one, go to the [Twitter Developer Portal](https://developer.twitter.com/en/apply-for-access) and apply for access.
2.  **Create a Project and App**: Once you have access, create a new Project and then create a new App within that project.
3.  **App Settings**:
    *   Find your App and go to its settings.
    *   Under **User authentication settings**, set up OAuth 1.0a.
    *   Set the **App permissions** to "Read and write".
    *   In the **Callback URI / Redirect URL** field, add the following URL: `http://localhost:3000/api/twitter/auth/callback`
4.  **Get Keys and Tokens**: Navigate to the "Keys and Tokens" tab for your App. Generate and copy your **API Key** and **API Key Secret**. These will be your `TWITTER_CONSUMER_KEY` and `TWITTER_CONSUMER_SECRET`.

### 3. Obtain Azure OpenAI Keys

1.  **Create an Azure OpenAI Resource**: In the [Azure Portal](https://portal.azure.com/), create a new Azure OpenAI resource.
2.  **Deploy a Model**: Once the resource is created, go to the Azure OpenAI Studio and deploy a new model (e.g., `gpt-35-turbo` or `gpt-4`). Take note of the **deployment name**.
3.  **Get Keys and Endpoint**: In your Azure OpenAI resource page, navigate to the "Keys and Endpoint" section. Copy the **API Key** and the **Endpoint URL**.

### 4. Installation and Setup

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd open-platter
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Create a local environment file**:
    Create a file named `.env.local` in the root of the project and add your keys:
    ```env
    # Twitter API Keys
    TWITTER_CONSUMER_KEY=your_twitter_api_key
    TWITTER_CONSUMER_SECRET=your_twitter_api_key_secret

    # Azure OpenAI Keys
    AZURE_OPENAI_API_KEY=your_azure_openai_api_key
    AZURE_OPENAI_ENDPOINT=your_azure_openai_endpoint
    AZURE_OPENAI_DEPLOYMENT_NAME=your_azure_openai_deployment_name
    ```

4.  **Set up the database**:
    This command will create the `sqlite.db` file and run the necessary migrations to set up your tables.
    ```bash
    npm run db:push
    ```

### 5. Running the Application

1.  **Start the development server**:
    ```bash
    npm run dev
    ```
    The application will be available at [http://localhost:3000](http://localhost:3000).

2.  **Run the scheduler cron job**:
    To have the application automatically post your scheduled tweets, you need to run the cron job script. Open a **new terminal window** and run:
    ```bash
    npm run cron:run
    ```
    This script will check for due posts every minute and send them to Twitter.