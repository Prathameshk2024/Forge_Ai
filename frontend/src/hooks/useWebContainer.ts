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
            console.error('[IntelliBuild] WebContainer failed to boot', e);
        });

        return () => {
            cancelled = true;
            // Guards only against teardown throwing synchronously. The promises
            // it aborts reject on their own and must be caught where they are
            // created - see the pipeTo handlers in PreviewFrame.
            try {
                instance?.teardown();
            } catch (e) {
                console.debug('[IntelliBuild] WebContainer teardown', e);
            }
        };
    }, [])

    return webcontainer;
}
