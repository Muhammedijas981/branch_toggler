# Vercel Branch Toggler 🎯

A simple tool to switch production branches on Vercel easily and efficiently.

---

## 📖 About

This tool is primarily built for developers who deploy their projects on **Vercel**.  
Originally, it was a personal project designed to solve a recurring problem I faced, but I realized sharing it might help others as well.

### 💡 The Idea

When you have a product or site in production and want to make fixes or add UI features, there’s often some downtime involved. While there are alternative solutions, some sites (like HackerRank) require downtime during updates for safety and consistency.

This inspired me to question the traditional approach:  

> **Why can’t we create a tool to toggle production branches dynamically and easily?**

The workflow looks like this:
1. Create a branch from your current production branch.
2. Deploy your changes there.
3. Switch production to that branch temporarily.
4. After testing and validation, switch back to the main production branch.  

### 🌐 Personal Use Case

I maintain a personal website with multiple UI branches — `UI_1`, `UI_2`, etc. Sometimes, I prefer one design over another depending on my mood or context (like while traveling).  

Instead of making manual changes and redeployments through the Vercel dashboard, this **branch toggler** lets me switch between UIs instantly.

While this may seem trivial, it perfectly fits my workflow. It also allows me to add new UI branches and immediately switch to them whenever needed.

---

## ✨ Features

- 🔍 Fetch all Vercel projects accessible via your API token.  
- 🌿 List all branches available for the selected project.  
- ⚡ Instantly switch production to any selected branch.  
- 🖥️ Real-time status messages and loading indicators.  
- 🔒 Secure handling of API tokens via environment variables.  
- ⚙️ Minimal setup and user-friendly interface.  

---

## 🛠️ Installation & Setup

1. **Clone the repository**

```bash
git clone https://github.com/Muhammedijas981/branch_toggler
cd branch-toggler
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**  
Create a `.env.local` file in the project root with the following:

```env
VERCEL_API_TOKEN=your-vercel-api-token
VERCEL_PROJECT_ID=your-vercel-project-id
PRODUCTION_DOMAIN=your-production-domain
NODE_ENV=production
```

4. **Run the development server**

```bash
npm run dev
```

5. Open your browser and visit:  
[http://localhost:3000](http://localhost:3000)

---

## 🎮 Usage

1. Select your project from the list.  
2. View the current production branch status.  
3. Choose a new branch to switch production to.  
4. Click the toggle button to switch instantly.  
5. Receive instant feedback on success or errors.  

---

## ❓ Why Use This Tool?

- Perfect for developers experimenting with multiple UI versions or feature branches.  
- Avoid downtime by switching production branches seamlessly.  
- Reduce manual deployment friction for personal projects or small teams.  
- Toggle between versions or deployments without leaving your app.  

---

## 🤝 Contributions

This started as a personal project, but I welcome contributions from the community!  

If you’d like to:
- Improve the UI  
- Enhance security  
- Support more platforms  
- Add new features  

Please feel free to open issues or submit pull requests.

---

## 📜 License

This project is licensed under the **MIT License**.

---

## 🙏 Acknowledgments

Inspired by the need to simplify production deployments on **Vercel** and the desire to manage multiple versioned UIs with ease.  

---

Thanks for checking out **Vercel Branch Toggler**!  
I hope it helps you manage your Vercel deployments more efficiently.
