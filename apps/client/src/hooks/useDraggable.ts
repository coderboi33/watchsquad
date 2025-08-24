'use client';

import { useState, useRef, useEffect, RefObject } from 'react';

interface DraggableOptions {
    elRef: RefObject<HTMLDivElement | null>;
    resizeHandleRef: RefObject<HTMLDivElement | null>;
}

export function useDraggable({ elRef, resizeHandleRef }: DraggableOptions) {
    const [position, setPosition] = useState({ x: 20, y: 20 });
    const [size, setSize] = useState({ width: 250, height: 140.625 }); // Initial size

    const stateRef = useRef({
        isDragging: false,
        isResizing: false,
        offset: { x: 0, y: 0 },
        initialSize: { width: 0, height: 0 },
    });

    useEffect(() => {
        const el = elRef.current;
        const resizeHandle = resizeHandleRef.current;
        if (!el || !resizeHandle) return;

        const onMouseDownDraggable = (e: MouseEvent) => {
            stateRef.current.isDragging = true;
            stateRef.current.offset = {
                x: e.clientX - el.offsetLeft,
                y: e.clientY - el.offsetTop,
            };
        };

        const onMouseDownResize = (e: MouseEvent) => {
            e.stopPropagation(); // Prevent triggering the drag event
            stateRef.current.isResizing = true;
            stateRef.current.offset = { x: e.clientX, y: e.clientY };
            stateRef.current.initialSize = { width: el.clientWidth, height: el.clientHeight };
        };

        const onMouseUp = () => {
            stateRef.current.isDragging = false;
            stateRef.current.isResizing = false;
        };

        const onMouseMove = (e: MouseEvent) => {
            const { isDragging, isResizing, offset, initialSize } = stateRef.current;

            if (isDragging) {
                // Dragging logic (with boundary checks)
                const parent = el.parentElement;
                if (!parent) return;
                let newX = e.clientX - offset.x;
                let newY = e.clientY - offset.y;
                newX = Math.max(0, Math.min(newX, parent.clientWidth - el.clientWidth));
                newY = Math.max(0, Math.min(newY, parent.clientHeight - el.clientHeight));
                setPosition({ x: newX, y: newY });
            }

            if (isResizing) {
                // Resizing logic
                const dx = e.clientX - offset.x;
                const newWidth = Math.max(150, initialSize.width + dx); // Min width 150px
                const newHeight = newWidth * (9 / 16); // Maintain 16:9 aspect ratio
                setSize({ width: newWidth, height: newHeight });
            }
        };

        el.addEventListener('mousedown', onMouseDownDraggable);
        resizeHandle.addEventListener('mousedown', onMouseDownResize);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        return () => {
            el.removeEventListener('mousedown', onMouseDownDraggable);
            resizeHandle.removeEventListener('mousedown', onMouseDownResize);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [elRef, resizeHandleRef]);

    return { position, size };
}