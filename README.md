# AWS EC2 Orchestrator

🚀 **Intelligent AWS EC2 instance orchestrator for dynamic project environments**

This service automatically manages AWS EC2 instances for on-demand development environments (like cloud VSCode instances), providing seamless scaling and resource allocation.

## 🎯 What it does

- **Auto-discovery**: Continuously monitors AWS Auto Scaling Group instances
- **Smart allocation**: Assigns idle EC2 instances to new projects  
- **Auto-scaling**: Maintains a buffer of ready-to-use instances
- **Resource cleanup**: Destroys instances when projects end
- **State management**: Tracks which instances are in use vs idle

## 💡 How it works

1. **EC2 Instances** run VSCode Server (from `Dockerfile`) accessible at port 8080
2. **Orchestrator** (this Node.js service) manages these instances:
   - Tracks which instances are free/busy
   - Assigns free instances to new projects
   - Scales the Auto Scaling Group when needed
3. **Developers** get instant access to cloud VSCode environments

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Orchestrator (Node.js)                  │
│  ┌───────────────┐ ┌────────────────┐ ┌─────────────────┐  │
│  │ GET /status   │ │ GET /:projectId│ │  POST /destroy  │  │
│  │ (monitoring)  │ │   (allocate)   │ │   (cleanup)     │  │
│  └───────────────┘ └────────────────┘ └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 AWS Auto Scaling Group                     │
│                   "vscode-asg"                            │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ EC2 Instance│  │ EC2 Instance│  │ EC2 Instance│  ...   │
│  │ VSCode      │  │ VSCode      │  │ VSCode      │        │
│  │ Server      │  │ Server      │  │ Server      │        │
│  │ :8080       │  │ :8080       │  │ :8080       │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 API Endpoints

### `GET /:projectId`
Allocates an idle EC2 instance to the specified project.

**Response:**
```json
{
  "ip": "54.123.45.67",
  "projectId": "my-project"
}
```

### `POST /destroy`
Terminates a specific EC2 instance.

**Request:**
```json
{
  "machineId": "i-1234567890abcdef0"
}
```

### `GET /status`
Returns current infrastructure status.

**Response:**
```json
{
  "totalMachines": 10,
  "idleMachines": 3,
  "usedMachines": 7,
  "machines": [...]
}
```

## 🚀 Setup

### Prerequisites

- AWS Account with EC2 and Auto Scaling permissions
- AWS Auto Scaling Group named `vscode-asg`
- Node.js 16+

### Environment Variables

Create a `.env` file:

```env
AWS_ACCESS_KEY=your_aws_access_key
AWS_SECRET_KEY=your_aws_secret_key
```

### Installation

```bash
# Clone repository
git clone https://github.com/your-username/aws-ec2-orchestrator
cd aws-ec2-orchestrator

# Install dependencies
npm install

# Start the service
npm start
```

The service will run on `http://localhost:9092`

## 📈 Scaling Logic

The orchestrator maintains a **buffer of 5 idle instances**:

| Current State | Action | Result |
|---------------|--------|--------|
| 10 total, 2 idle | Scale up | 13 instances (+3) |
| 8 total, 1 idle | Scale up | 12 instances (+4) |
| 15 total, 7 idle | No change | 15 instances (sufficient buffer) |


## 🔍 Monitoring

The service logs detailed information about:
- Instance discovery and refresh cycles
- Project allocations and scaling decisions  
- AWS API interactions and errors

Example logs:
```
Refreshing instances...
Found 10 running machines
Idle machines: 3
Used machines: 7
Current machines: 10, Idle: 2, Scaling to: 13
Scaled Auto Scaling Group to 13 instances
```

## 🔒 Security Considerations

- Store AWS credentials securely (AWS IAM roles recommended)
- Use HTTPS in production
- Implement authentication for API endpoints
- Set up proper VPC security groups

## 🏷️ AWS Resources

This orchestrator expects:
- **Auto Scaling Group**: Named `vscode-asg`
  - Should use EC2 instances built from the included `Dockerfile`
  - Instances must have **public IP addresses**
  - Launch template should expose port 8080 for VSCode Server
- **IAM Permissions**: 
  - `autoscaling:DescribeAutoScalingInstances`
  - `autoscaling:SetDesiredCapacity`  
  - `autoscaling:TerminateInstanceInAutoScalingGroup`
  - `ec2:DescribeInstances`
- **Security Groups**: Allow inbound traffic on port 8080 (VSCode Server)

## 📦 Docker Architecture

### EC2 Instances (VSCode Server)
The included `Dockerfile` is used for **EC2 instances** that run VSCode Server:

```dockerfile
FROM codercom/code-server:4.96.4
USER root
RUN apt-get update \
    && apt-get install -y curl \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
USER coder
EXPOSE 8080
RUN mkdir -p /tmp/bolty-worker
CMD ["code-server", "--auth", "none", "--bind-addr", "0.0.0.0:8080", "/tmp/bolty-worker"]
```

This creates VSCode Server instances accessible at `http://instance-ip:8080`

### Orchestrator Deployment
For the orchestrator itself, you can use:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 9092
CMD ["npm", "start"]
```

