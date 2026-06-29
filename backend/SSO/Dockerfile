# stage 1: build .jar
FROM maven:3.9.9-eclipse-temurin-21 AS build

WORKDIR /builder

COPY pom.xml .
COPY src ./src

RUN mvn clean package -DskipTests


# stage 2: extract .jar layers
FROM eclipse-temurin:21-jre-jammy AS extract

WORKDIR /builder

COPY --from=build /builder/target/*.jar app.jar

RUN java -Djarmode=tools -jar app.jar extract --layers --destination extracted

# stage 3: runtime environment
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

COPY --from=extract /builder/extracted/dependencies/ ./
COPY --from=extract /builder/extracted/spring-boot-loader/ ./
COPY --from=extract /builder/extracted/snapshot-dependencies/ ./
COPY --from=extract /builder/extracted/application/ ./

EXPOSE 8080

ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]