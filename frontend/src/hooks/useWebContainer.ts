import { useEffect, useState } from "react";
import { WebContainer } from '@webcontainer/api';

export function useWebContainer() {
    const [webcontainer, setWebcontainer] = useState<WebContainer>();

    useEffect(() => {
        let cancelled = false;
        let instance: WebContainer | undefined;

        WebContainer.boot().then((webcontainerInstance) => {
            if (cancelled) {
                webcontainerInstance.teardown();
                return;
            }
            instance = webcontainerInstance;
            setWebcontainer(webcontainerInstance);
        });

        return () => {
            cancelled = true;
            instance?.teardown();
        };
    }, [])

    return webcontainer;
}
