# 🎥 WatchSquad

WatchSquad is a **real-time video calling platform** built with a modern tech stack.  
This project aims to provide a seamless, high-quality communication experience for everyone.  
Currently in the foundational stage — with many exciting features on the horizon. 🚀

---

## 📖 About The Project

This application is designed to be a **simple yet powerful video-calling solution**.  
It leverages **WebSockets** for real-time communication and is structured on a **high-performance Turborepo monorepo**.

---

## 🛠️ Built With

- **Monorepo**: [Turborepo](https://turbo.build/repo)  
- **Frontend**: [Next.js](https://nextjs.org/)  
- **Backend**: [Express.js](https://expressjs.com/)  
- **Real-time Communication**: [Socket.IO](https://socket.io/)  

---

## 🔧 Getting Started

Follow these instructions to set up the project locally for development and testing.

### ✅ Prerequisites
Make sure you have the following installed:
- [Node.js](https://nodejs.org/) (v18 or later recommended)
- npm (or yarn/pnpm)

Update npm to the latest version:
```bash
npm install npm@latest -g
```

### ⚙️ Installation & Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/coderboi33/watchsquad.git
   ```

2. Navigate to the project directory:
   ```bash
   cd watchsquad
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Set up environment variables:

   - For the **backend app** (e.g., `apps/server`), create a file named `.env`:
     ```env
     PORT=5000
     ```

   - For the **frontend Next.js app** (e.g., `apps/web`), create a file named `.env.local`:
     ```env
     NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
     NEXT_PUBLIC_API_URL=http://localhost:5000
     ```

   > ℹ️ For local development, use `http://`.  
   > Switch to `ws://` or `wss://` if setting up secure WebSockets.

---

## ▶️ Usage

Run the development server for **all apps** from the root directory:
```bash
npm run dev
```

This will start both the frontend and backend servers concurrently.  
Open your browser and navigate to:  
👉 [http://localhost:3000](http://localhost:3000)  

---

## 🗺️ Roadmap

Planned features for future releases:

- [ ] User Authentication  
- [ ] Multi-user Video Rooms  
- [ ] Screen Sharing  
- [ ] Text Chat in Rooms  

Check the [open issues](https://github.com/coderboi33/watchsquad/issues) for more proposed features and known issues.

---

## 🤝 Contributing

Contributions are what make the open-source community so amazing!  
We welcome your ideas and improvements. 🙌

1. Fork the project  
2. Create your feature branch:  
   ```bash
   git checkout -b feature/AmazingFeature
   ```
3. Commit your changes:  
   ```bash
   git commit -m 'Add some AmazingFeature'
   ```
4. Push to the branch:  
   ```bash
   git push origin feature/AmazingFeature
   ```
5. Open a Pull Request  

---

## 📄 License

Distributed under the **MIT License**.  
See [`LICENSE.txt`](LICENSE.txt) for details.  

---

## 📧 Contact

**Your Name** – [@your_twitter](https://twitter.com/) – your.email@example.com  

Project Link: [https://github.com/coderboi33/watchsquad](https://github.com/coderboi33/watchsquad)
