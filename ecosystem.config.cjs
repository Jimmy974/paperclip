module.exports = {
  apps: [
    {
      name: "paperclip",
      cwd: "/home/clawdbot/paperclip",
      script: "pnpm",
      args: "dev",
      env: {
        BETTER_AUTH_SECRET: "01f5f8bf4cfb187bdfb583a7be1bf534ca4000abbc7bd5942156ff0033fd888d",
        PAPERCLIP_AGENT_JWT_SECRET: "d823358ccb547be89472ae52d95da5f9ecfc0b279280cb2ebcddfcc2e8a7a2e3",
      },
      // Strip Claude env vars to prevent "cannot be launched inside another Claude Code session" errors
      filter_env: ["CLAUDECODE", "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS", "CLAUDE_CODE_ENTRYPOINT"],
      log_file: "/tmp/paperclip-pm2.log",
      out_file: "/tmp/paperclip-pm2-out.log",
      error_file: "/tmp/paperclip-pm2-err.log",
      autorestart: true,
      max_restarts: 5,
      restart_delay: 3000,
    },
  ],
};
