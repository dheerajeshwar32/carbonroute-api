variable "gemini_api_key" {
  description = "Google Gemini API Key"
  type        = string
  sensitive   = true
}

variable "redis_url" {
  description = "Upstash Redis Connection URL"
  type        = string
  sensitive   = true
}

provider "aws" {
  region = "ap-south-2"
}

resource "aws_ecr_repository" "carbonroute_repo" {
  name                 = "carbonroute-proxy"
  image_tag_mutability = "MUTABLE"
  force_delete         = true
}

# 1. Network Configuration
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

resource "aws_security_group" "carbonroute_sg" {
  name        = "carbonroute-sg"
  description = "Allow inbound HTTP traffic on port 3000"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# 2. Secrets Manager resources for secure secret injection
resource "aws_secretsmanager_secret" "gemini_api_key" {
  name        = "carbonroute/gemini-api-key"
  description = "Google Gemini API Key for CarbonRoute inference"
}

resource "aws_secretsmanager_secret_version" "gemini_api_key" {
  secret_id     = aws_secretsmanager_secret.gemini_api_key.id
  secret_string = var.gemini_api_key
}

resource "aws_secretsmanager_secret" "redis_url" {
  name        = "carbonroute/redis-url"
  description = "Upstash Redis connection URL for CarbonRoute edge cache"
}

resource "aws_secretsmanager_secret_version" "redis_url" {
  secret_id     = aws_secretsmanager_secret.redis_url.id
  secret_string = var.redis_url
}

# 3. IAM Permissions for Fargate
resource "aws_iam_role" "ecs_execution_role" {
  name = "carbonroute_ecs_execution_role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_role_policy" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Grant the ECS execution role permission to read the secrets
resource "aws_iam_role_policy" "ecs_secrets_access" {
  name = "carbonroute-ecs-secrets-access"
  role = aws_iam_role.ecs_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue"
      ]
      Resource = [
        aws_secretsmanager_secret.gemini_api_key.arn,
        aws_secretsmanager_secret.redis_url.arn
      ]
    }]
  })
}

# 4. ECS Cluster and Service Deployment
resource "aws_ecs_cluster" "carbonroute_cluster" {
  name = "carbonroute-cluster"
}

resource "aws_ecs_task_definition" "carbonroute_task" {
  family                   = "carbonroute-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn

  container_definitions = jsonencode([{
    name      = "carbonroute-container"
    image     = "613538400427.dkr.ecr.ap-south-2.amazonaws.com/carbonroute-proxy:latest"
    essential = true
    portMappings = [{
      containerPort = 3000
      hostPort      = 3000
    }]
    secrets = [
      {
        name      = "GEMINI_API_KEY"
        valueFrom = aws_secretsmanager_secret.gemini_api_key.arn
      },
      {
        name      = "REDIS_URL"
        valueFrom = aws_secretsmanager_secret.redis_url.arn
      }
    ]
  }])
}

resource "aws_ecs_service" "carbonroute_service" {
  name            = "carbonroute-service"
  cluster         = aws_ecs_cluster.carbonroute_cluster.id
  task_definition = aws_ecs_task_definition.carbonroute_task.arn
  launch_type     = "FARGATE"
  desired_count   = 1

  network_configuration {
    subnets          = data.aws_subnets.default.ids
    security_groups  = [aws_security_group.carbonroute_sg.id]
    assign_public_ip = true
  }
}
