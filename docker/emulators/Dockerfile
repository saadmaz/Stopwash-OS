# Firebase Emulator Suite for local development and CI. No real project is ever contacted:
# the project id is demo-stopwash (the "demo-" prefix keeps the emulators fully offline).
FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openjdk-17-jre-headless curl \
  && rm -rf /var/lib/apt/lists/*

ARG FIREBASE_TOOLS_VERSION=15.36.0
RUN npm install -g firebase-tools@${FIREBASE_TOOLS_VERSION} \
  && firebase setup:emulators:firestore \
  && firebase setup:emulators:storage \
  && firebase setup:emulators:ui

WORKDIR /firebase
EXPOSE 4000 4400 4500 8081 9099 9199

HEALTHCHECK --interval=5s --timeout=3s --retries=30 CMD curl -sf http://127.0.0.1:8081/ || exit 1

COPY start.sh /usr/local/bin/start-emulators
RUN chmod +x /usr/local/bin/start-emulators
CMD ["start-emulators"]
