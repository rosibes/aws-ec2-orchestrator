# AWS EC2 Orchestrator

🚀 **Intelligent AWS EC2 instance orchestrator for dynamic project environments**

This service automatically manages AWS EC2 instances for on-demand development environments (like cloud VSCode instances), providing seamless scaling and resource allocation.

## 🎯 What it does

- **Auto-discovery**: Continuously monitors AWS Auto Scaling Group instances
- **Smart allocation**: Assigns idle EC2 instances to new projects  
- **Auto-scaling**: Maintains a buffer of ready-to-use instances
- **Resource cleanup**: Destroys instances when projects end
- **State management**: Tracks which instances are in use vs idle

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   GET /health   │    │ GET /:projectId  │    │  POST /destroy  │
│  (monitoring)   │    │   (allocate)     │    │   (cleanup)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                 AWS Auto Scaling Group                     │
   │                   "vscode-asg"                            │
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

## 🛠️ Usage Examples

### Allocate instance for project
```bash
curl http://localhost:9092/my-project-name
```

### Check status
```bash
curl http://localhost:9092/status
```

### Destroy instance
```bash
curl -X POST http://localhost:9092/destroy \
  -H "Content-Type: application/json" \
  -d '{"machineId": "i-1234567890abcdef0"}'
```

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
- **EC2 Instances**: With public IP addresses
- **IAM Permissions**: 
  - `autoscaling:DescribeAutoScalingInstances`
  - `autoscaling:SetDesiredCapacity`  
  - `autoscaling:TerminateInstanceInAutoScalingGroup`
  - `ec2:DescribeInstances`

## 📦 Docker Support

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 9092
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Built for dynamic cloud development environments** 🚀 