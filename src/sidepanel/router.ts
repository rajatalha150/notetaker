import {
  createRouter,
  createRootRoute,
  createRoute,
  createHashHistory,
} from "@tanstack/react-router";
import App from "./App";
import { RecordingsPage } from "./routes/recordings";
import { RecordingDetailPage } from "./routes/recording.$id";
import { SettingsPage } from "./routes/settings";

const rootRoute = createRootRoute({ component: App });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: RecordingsPage,
});

const recordingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/recording/$id",
  component: RecordingDetailPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([indexRoute, recordingRoute, settingsRoute]);

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
