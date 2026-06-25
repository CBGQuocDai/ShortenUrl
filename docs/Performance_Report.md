# Performance Test Report - ShortenUrl System

## 1. Test Environment (Môi trường Test)

- **Host OS**: Linux Container (VM/Cloud Engine)
- **Architecture**: Docker Compose (Single Host Deployment, Local Bridge Network)
- **Gateway**: NGINX (acting as Reverse Proxy mapped to port 3000)
- **Database (Core)**:
  - **PostgreSQL 15** (SSO Auth Data)
  - **MySQL 8.0** (Shorten Links Mapping Data)
- **Cache Engine**: Redis 7-Alpine (Dedicated containers for `sso-logic` and `shorten-logic`)
- **Backend Services**:
  - **SSO Service**: Spring Boot (Java 21)
  - **Shorten API**: Gin Gonic (Go 1.22) with Read-Through caching mechanism
- **Load Testing Tool**: Grafana K6 (simulating User Traffic into Nginx Gateway)

## 2. Test Scenarios (Kịch bản)

The test focused on analyzing URL Read Redirection (`GET /api/v1/shorten/:shortCode`), which is the most critical flow of the architecture.
The test plan simulates varying phases of high concurrency (from 200 users to 1000 simultaneous users).

### Load Stages:

1. `5s`: Ramp up to 200 Virtual Users (VU)
2. `10s`: Jump to 500 VUs
3. `10s`: Peak at 1000 VUs
4. `10s`: Hold at 1000 VUs
5. `5s`: Ramp down to 0 VUs

Test Execution Duration: **~40 seconds**.

## 3. Results (Kết quả đo lường)

### Metrics

| Metric               | Result         | Description                                                                                                            |
| :------------------- | :------------- | :--------------------------------------------------------------------------------------------------------------------- |
| **Total Requests**   | `46,591`       | Tổng số lượng HTTP request đã gửi và xử lý trong 40 giây.                                                              |
| **Throughput (RPS)** | `~1,164 req/s` | Tần suất gửi request đạt đỉnh là hơn 1.1 ngàn req/s.                                                                   |
| **Success Rate**     | `60.59%`       | Tỉ lệ xử lý thành công không bị timeout/rớt.                                                                           |
| **Failure Rate**     | `39.40%`       | Bắt đầu xảy ra tình trạng Nginx thắt cổ chai và trả về 502/504 Bad Gateway do Go API quá tải khi chạm ngưỡng 1000 VUs. |
| **Avg Latency**      | `456ms`        | Thời gian trung bình giải quyết 1 Request bị đội lên nặng.                                                             |
| **p(95) Latency**    | `1.29s`        | 95% số request hoàn thành dưới 1.29s ở trong thời điểm Peak.                                                           |

### Analysis

1. **Threshold Found (Ngưỡng bục vỡ của hệ thống)**:
   - Khi chạy ở **200 VUs liên tục**, hệ thống vẫn maintain ở mức Latency `47ms` với Tỉ lệ Success là **100%** (RPS đạt 600 req/s).
   - Tuy nhiên, khi hệ thống bị stress mạnh chạm mốc **500 và 1000 VUs đồng thời**, Tỉ lệ xử lý sụt giảm. 40% request bị chặn đầu vì container Go Shorten URL không đủ Threads / CPU limit để accept socket, dẫn đến timeout socket từ phía NGINX Gateway, gây ra các response status phi 200.
2. **Bottleneck Diagnostics (Chẩn đoán cổ chai)**:
   - Các Container (MySQL, Redis, Nginx, Go) hiện đang **cạnh tranh tài nguyên CPU/RAM chung của 1 Single Compute Instance**. Khi CPU Usage chạm mốc 100%, hệ thống tự động suy giảm năng lực.
   - Quá trình chạy ngầm Goroutine để đếm số lượt click `access_count` vào DB có thể làm ngập (overload) pool kết nối của MySQL (connection starvation).

## 4. Conclusion & Scaling Recommendations (Đề xuất Scale)

Môi trường hiện tại đã đáp ứng hoàn hảo cho **Traffic bậc trung bình-khá** (vài trăm ngàn Click một ngày không thành vấn đề với 100% Success rate).

**Để chinh phục Traffic triệu Click trong thời gian ngắn (Micro-moments):**

1. **Auto-scaling**: Mang khối lượng Docker Compose này đẩy lên Kubernetes (K8s) Pods hoặc Docker Swarm để có thể Scale-out (Nhân bản các worker `go-shorten-service` thành 5-10 Nodes song song).
2. **Buffer Messages (Message Broker)**: Thay vì Gorountine đập thẳng vào MySQL Async, sử dụng Kafka/RabbitMQ để gom log Click-Count, cứu MySQL khỏi Connection limits pool.
3. **Optimizing Redis**: Giới hạn lại Max-connection của Redis để tránh Overhead socket trong máy chủ.
