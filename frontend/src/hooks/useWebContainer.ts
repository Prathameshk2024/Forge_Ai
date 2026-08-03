import { useEffect, useState } from "react";
import { WebContainer } from '@webcontainer/api';

export function useWebContainer() {
    const [webcontainer, setWebcontainer] = useState<WebContainer>();

    useEffect(() => {
        let cancelled = false;
        let instance: WebContainer | undefined;

        // Must match the Cross-Origin-Embedder-Policy header the app is served
        // with (see vite.config.ts and the host header config).
        WebContainer.boot({ coep: 'credentialless' }).then((webcontainerInstance) => {
            if (cancelled) {
                webcontainerInstance.teardown();
                return;
            }
            instance = webcontainerInstance;
            setWebcontainer(webcontainerInstance);
        }).catch((e) => {
            console.error('[ForgeAI] WebContainer failed to boot', e);
        });

        return () => {
            cancelled = true;
            // Tearing down kills any running npm install / dev server, which
            // rejects their pending promises. Without this the abort surfaces
            // as an uncaught "Process aborted" in the console on every unmount.
            try {
                instance?.teardown();
            } catch (e) {
                console.debug('[ForgeAI] WebContainer teardown', e);
            }
        };
    }, [])

    return webcontainer;
}
