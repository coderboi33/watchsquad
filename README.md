WatchSquad 📹
WatchSquad is a real-time video calling platform built with a modern tech stack. This project aims to provide a seamless and high-quality communication experience for everyone. It's currently in the foundational stage, with many exciting features on the horizon.

🚀 About The Project
This application is designed to be a simple yet powerful video-calling solution. It leverages WebSockets for real-time communication and is built on a high-performance Turborepo monorepo structure.

Built With
This project is made possible by these incredible technologies:

Monorepo: Turborepo

Frontend: Next.js

Backend: Express.js

Real-time Communication: Socket.IO

🔧 Getting Started
Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

Prerequisites
Make sure you have Node.js and npm (or yarn/pnpm) installed on your system.

Node.js (v18 or later recommended)

npm

npm install npm@latest -g

Installation & Setup
Clone the repository

git clone https://github.com/coderboi33/watchsquad.git

Navigate to the project directory

cd watchsquad

Install all dependencies

npm install

Set up environment variables

You will need to create two environment files for the frontend and backend applications.

For the backend app (e.g., in apps/server), create a file named .env:

PORT=5000

For the frontend Next.js app (e.g., in apps/web), create a file named .env.local:

# The URL should point to your backend server
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
NEXT_PUBLIC_API_URL=http://localhost:5000

Note: For local development, http:// is typically used. Adjust to wss:// or ws:// if you have a specific setup for secure WebSockets.

Usage
Once the installation and setup are complete, you can run the application.

Run the development server for all apps from the root directory:

npm run dev

This command will start both the frontend and backend servers concurrently. Open your browser and navigate to the frontend URL (usually http://localhost:3000) to see the application in action.

🗺️ Roadmap
This project is still under development. Here are some of the features planned for future releases:

[ ] User Authentication

[ ] Multi-user video rooms

[ ] Screen Sharing

[ ] Text Chat in rooms

See the open issues for a full list of proposed features and known issues.

🤝 Contributing
Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are greatly appreciated.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".

Fork the Project

Create your Feature Branch (git checkout -b feature/AmazingFeature)

Commit your Changes (git commit -m 'Add some AmazingFeature')

Push to the Branch (git push origin feature/AmazingFeature)

Open a Pull Request

📄 License
Distributed under the MIT License. See LICENSE.txt for more information.

(Note: You will need to add a LICENSE.txt file to your repository. The MIT License is a popular choice.)

📧 Contact
Your Name - @your_twitter - your.email@example.com

Project Link: https://github.com/coderboi33/watchsquad.git