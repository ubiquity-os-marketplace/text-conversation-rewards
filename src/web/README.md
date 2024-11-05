# @ubiquity-os/text-conversation-rewards-ui

This project provides a user interface for managing text conversation rewards. It includes several scripts for building, developing, and previewing the UI.

## Scripts

You can run the following scripts using `bun run <script>`:

- **server**: Starts the server with file watching.
- **ui:dev**: Starts the Vite development server.
- **ui:build**: Builds the production-ready UI bundle.
- **ui:build-watch**: Builds the UI bundle and watches for changes.
- **ui:preview**: Previews the built UI bundle.

## How to Get Started

1. **Install dependencies**: Make sure you have [Bun](https://bun.sh/) installed, then run:
    ```sh
    bun install
    ```

2. **Start the server**:
    ```sh
    bun run server
    ```

3. **Develop the UI**:
    ```sh
    bun run ui:dev
    ```

4. **Build the UI for production**:
    ```sh
    bun run ui:build
    ```

5. **Preview the built UI**:
    ```sh
    bun run ui:preview
    ```

> [!WARNING]
> To see the changes you made on the UI when using the `server`, you need first to run `ui:build` as files are 
> statically served.

### For Development

To develop the UI and see changes in real-time, use the `ui:dev` script. This will start a Vite development server which you can access in your browser.

### For Building and Previewing

When you're ready to build the UI for production, use the `ui:build` script. You can then use the `ui:preview` script to preview the built application.
