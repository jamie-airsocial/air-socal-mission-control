'use client';

import { Node, mergeAttributes } from '@tiptap/react';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Scissors, AlignLeft, AlignCenter, AlignRight, Trash2, Check, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

type HandlePosition = 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

function ResizableImageView({ node, updateAttributes, selected, deleteNode }: any) {
  const { src, alt, title, width, alignment, cropX, cropY, cropWidth, cropHeight } = node.attrs;
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [cropRect, setCropRect] = useState({ x: 0, y: 0, w: 100, h: 100 });
  const [showToolbar, setShowToolbar] = useState(false);
  const naturalSize = useRef({ w: 0, h: 0 });

  useEffect(() => {
    setShowToolbar(selected);
    if (!selected) setIsCropping(false);
  }, [selected]);

  useEffect(() => {
    if (src) {
      const img = new Image();
      img.onload = () => {
        naturalSize.current = { w: img.naturalWidth, h: img.naturalHeight };
      };
      img.src = src;
    }
  }, [src]);

  useEffect(() => {
    if (isCropping) {
      setCropRect({
        x: cropX ?? 0,
        y: cropY ?? 0,
        w: cropWidth ?? 100,
        h: cropHeight ?? 100,
      });
    }
  }, [isCropping, cropX, cropY, cropWidth, cropHeight]);

  // Resize: always lock aspect ratio, scale the cropped view proportionally
  const handleResize = useCallback(
    (e: React.MouseEvent, position: HandlePosition) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);

      const startX = e.clientX;
      const startY = e.clientY;
      const el = containerRef.current;
      if (!el) return;
      const startWidth = el.offsetWidth;
      const startHeight = el.offsetHeight;
      const aspectRatio = startWidth / startHeight;

      const isRight = position === 'right' || position.includes('right');
      const isBottom = position === 'bottom' || position.includes('bottom');

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const diffX = moveEvent.clientX - startX;
        const diffY = moveEvent.clientY - startY;

        let newWidth: number;

        if (position === 'top' || position === 'bottom') {
          const sign = isBottom ? 1 : -1;
          const newHeight = startHeight + diffY * sign;
          newWidth = newHeight * aspectRatio;
        } else {
          const sign = isRight ? 1 : -1;
          newWidth = startWidth + diffX * sign;
        }

        newWidth = Math.max(80, Math.min(newWidth, 1200));
        const newHeight = newWidth / aspectRatio;

        el.style.width = `${newWidth}px`;
        el.style.height = `${newHeight}px`;
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        const finalWidth = el.offsetWidth;
        updateAttributes({ width: Math.round(finalWidth) });
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [updateAttributes]
  );

  // Crop drag (handles + move)
  const handleCropDrag = useCallback(
    (e: React.MouseEvent, handle: HandlePosition | 'move') => {
      e.preventDefault();
      e.stopPropagation();

      const imgEl = imgRef.current;
      if (!imgEl) return;
      const imgRect = imgEl.getBoundingClientRect();

      const startX = e.clientX;
      const startY = e.clientY;
      const startCrop = { ...cropRect };

      const handleMove = (moveEvent: MouseEvent) => {
        const pctDiffX = ((moveEvent.clientX - startX) / imgRect.width) * 100;
        const pctDiffY = ((moveEvent.clientY - startY) / imgRect.height) * 100;

        const r = { ...startCrop };

        if (handle === 'move') {
          r.x = Math.max(0, Math.min(100 - r.w, startCrop.x + pctDiffX));
          r.y = Math.max(0, Math.min(100 - r.h, startCrop.y + pctDiffY));
        } else {
          if (handle.includes('left')) {
            const newX = Math.max(0, Math.min(startCrop.x + startCrop.w - 5, startCrop.x + pctDiffX));
            r.w = startCrop.w - (newX - startCrop.x);
            r.x = newX;
          }
          if (handle.includes('right')) {
            r.w = Math.max(5, Math.min(100 - startCrop.x, startCrop.w + pctDiffX));
          }
          if (handle.includes('top')) {
            const newY = Math.max(0, Math.min(startCrop.y + startCrop.h - 5, startCrop.y + pctDiffY));
            r.h = startCrop.h - (newY - startCrop.y);
            r.y = newY;
          }
          if (handle.includes('bottom')) {
            r.h = Math.max(5, Math.min(100 - startCrop.y, startCrop.h + pctDiffY));
          }
        }

        setCropRect(r);
      };

      const handleUp = () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
      };

      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
    },
    [cropRect]
  );

  const confirmCrop = () => {
    updateAttributes({
      cropX: Math.round(cropRect.x * 100) / 100,
      cropY: Math.round(cropRect.y * 100) / 100,
      cropWidth: Math.round(cropRect.w * 100) / 100,
      cropHeight: Math.round(cropRect.h * 100) / 100,
    });
    setIsCropping(false);
  };

  const cancelCrop = () => setIsCropping(false);

  const resetCrop = () => {
    updateAttributes({ cropX: 0, cropY: 0, cropWidth: 100, cropHeight: 100 });
  };

  const parsedWidth = typeof width === 'string' ? parseInt(width, 10) || undefined : width;

  const cX = cropX ?? 0;
  const cY = cropY ?? 0;
  const cW = cropWidth ?? 100;
  const cH = cropHeight ?? 100;
  const hasCrop = !(cX === 0 && cY === 0 && cW === 100 && cH === 100);

  const justifyClass = alignment === 'center' ? 'justify-center' : alignment === 'right' ? 'justify-end' : 'justify-start';

  // Build crop display styles using the overflow:hidden + positioned img approach
  // Container is the "viewport" into the image. Image is scaled so the crop region fills the container.
  const wrapperStyle: React.CSSProperties = {};
  const imgStyle: React.CSSProperties = {};

  if (hasCrop && !isCropping) {
    wrapperStyle.overflow = 'hidden';
    wrapperStyle.position = 'relative';
    // Image width = container width * (100 / cropWidth%)
    // This makes the cropped region exactly fill the container width
    imgStyle.position = 'absolute';
    imgStyle.width = `${100 / (cW / 100)}%`;
    imgStyle.height = `${100 / (cH / 100)}%`;
    imgStyle.left = `${-(cX / cW) * 100}%`;
    imgStyle.top = `${-(cY / cH) * 100}%`;
    imgStyle.maxWidth = 'none';

    // Compute aspect ratio of the cropped region to set container height
    // We need natural image dimensions for this
    if (naturalSize.current.w > 0) {
      const cropAspect = (cW / 100 * naturalSize.current.w) / (cH / 100 * naturalSize.current.h);
      const displayW = parsedWidth || 400;
      wrapperStyle.width = `${displayW}px`;
      wrapperStyle.height = `${displayW / cropAspect}px`;
    }
  }

  // For non-cropped, let container size naturally
  const containerStyle: React.CSSProperties = {
    width: parsedWidth ? `${parsedWidth}px` : undefined,
  };

  // When cropped, the container dimensions come from the wrapper
  if (hasCrop && !isCropping) {
    containerStyle.width = wrapperStyle.width as string;
    containerStyle.height = wrapperStyle.height as string;
    containerStyle.position = 'relative';
  }

  const handles: HandlePosition[] = ['top-left', 'top', 'top-right', 'left', 'right', 'bottom-left', 'bottom', 'bottom-right'];

  return (
    <NodeViewWrapper className={`resizable-image-wrapper flex ${justifyClass}`} data-drag-handle>
      <div
        ref={containerRef}
        className={`resizable-image-container ${selected ? 'selected' : ''} ${isResizing ? 'resizing' : ''}`}
        style={containerStyle}
        onDoubleClick={() => {
          if (hasCrop && !isCropping) setIsCropping(true);
        }}
      >
        {/* Floating Toolbar */}
        {showToolbar && !isCropping && (
          <div className="image-floating-toolbar" contentEditable={false}>
            <Tooltip><TooltipTrigger asChild><button type="button" onClick={() => setIsCropping(true)} className="image-toolbar-btn">
              <Scissors className="h-3.5 w-3.5" />
            </button></TooltipTrigger><TooltipContent side="bottom" className="text-xs">Crop image</TooltipContent></Tooltip>
            <div className="image-toolbar-divider" />
            <Tooltip><TooltipTrigger asChild><button type="button" onClick={() => updateAttributes({ alignment: 'left' })}
              className={`image-toolbar-btn ${alignment === 'left' || !alignment ? 'active' : ''}`}>
              <AlignLeft className="h-3.5 w-3.5" />
            </button></TooltipTrigger><TooltipContent side="bottom" className="text-xs">Align left</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><button type="button" onClick={() => updateAttributes({ alignment: 'center' })}
              className={`image-toolbar-btn ${alignment === 'center' ? 'active' : ''}`}>
              <AlignCenter className="h-3.5 w-3.5" />
            </button></TooltipTrigger><TooltipContent side="bottom" className="text-xs">Align center</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><button type="button" onClick={() => updateAttributes({ alignment: 'right' })}
              className={`image-toolbar-btn ${alignment === 'right' ? 'active' : ''}`}>
              <AlignRight className="h-3.5 w-3.5" />
            </button></TooltipTrigger><TooltipContent side="bottom" className="text-xs">Align right</TooltipContent></Tooltip>
            <div className="image-toolbar-divider" />
            <Tooltip><TooltipTrigger asChild><button type="button" onClick={() => deleteNode()}
              className="image-toolbar-btn image-toolbar-btn-danger">
              <Trash2 className="h-3.5 w-3.5" />
            </button></TooltipTrigger><TooltipContent side="bottom" className="text-xs">Delete image</TooltipContent></Tooltip>
          </div>
        )}

        {/* Crop mode toolbar */}
        {isCropping && (
          <div className="image-floating-toolbar" contentEditable={false}>
            <span className="text-xs text-foreground/70 px-1">Crop</span>
            <Tooltip><TooltipTrigger asChild><button type="button" onClick={confirmCrop} className="image-toolbar-btn image-toolbar-btn-confirm">
              <Check className="h-3.5 w-3.5" />
            </button></TooltipTrigger><TooltipContent side="bottom" className="text-xs">Apply crop</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><button type="button" onClick={cancelCrop} className="image-toolbar-btn image-toolbar-btn-danger">
              <X className="h-3.5 w-3.5" />
            </button></TooltipTrigger><TooltipContent side="bottom" className="text-xs">Cancel crop</TooltipContent></Tooltip>
            {hasCrop && (
              <Tooltip><TooltipTrigger asChild><button type="button" onClick={resetCrop} className="image-toolbar-btn text-xs px-1.5">
                Reset
              </button></TooltipTrigger><TooltipContent side="bottom" className="text-xs">Reset crop</TooltipContent></Tooltip>
            )}
          </div>
        )}

        {/* Normal view: cropped image display */}
        {!isCropping && (
          <div style={wrapperStyle} className="crop-display-wrapper">
            <img
              ref={imgRef}
              src={src}
              alt={alt || ''}
              title={title || ''} // eslint-disable-line mission-control/no-native-title-tooltip -- standard HTML img title attribute for accessibility
              draggable={false}
              style={hasCrop ? imgStyle : {}}
            />
          </div>
        )}

        {/* Crop mode: full image with overlay */}
        {isCropping && (
          <>
            <div className="crop-display-wrapper">
              <img
                ref={imgRef}
                src={src}
                alt={alt || ''}
                title={title || ''} // eslint-disable-line mission-control/no-native-title-tooltip -- standard HTML img title attribute for accessibility
                draggable={false}
              />
            </div>
            <div className="crop-overlay" contentEditable={false}>
              {/* Darkened regions */}
              <div className="crop-dark crop-dark-top" style={{ height: `${cropRect.y}%` }} />
              <div className="crop-dark crop-dark-bottom" style={{ top: `${cropRect.y + cropRect.h}%`, height: `${100 - cropRect.y - cropRect.h}%` }} />
              <div className="crop-dark crop-dark-left" style={{ top: `${cropRect.y}%`, height: `${cropRect.h}%`, width: `${cropRect.x}%` }} />
              <div className="crop-dark crop-dark-right" style={{ top: `${cropRect.y}%`, height: `${cropRect.h}%`, left: `${cropRect.x + cropRect.w}%`, width: `${100 - cropRect.x - cropRect.w}%` }} />

              {/* Crop region */}
              <div
                className="crop-region"
                style={{
                  left: `${cropRect.x}%`,
                  top: `${cropRect.y}%`,
                  width: `${cropRect.w}%`,
                  height: `${cropRect.h}%`,
                }}
                onMouseDown={(e) => handleCropDrag(e, 'move')}
              >
                {handles.map((pos) => (
                  <div
                    key={pos}
                    className={`crop-handle crop-handle-${pos}`}
                    onMouseDown={(e) => handleCropDrag(e, pos)}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Resize handles */}
        {!isCropping && (selected || isResizing) && handles.map((pos) => (
          <div
            key={pos}
            className={`resize-handle-v2 resize-handle-v2-${pos}`}
            onMouseDown={(e) => handleResize(e, pos)}
          />
        ))}
      </div>
    </NodeViewWrapper>
  );
}

export const ResizableImage = Node.create({
  name: 'image',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const img = element.tagName === 'IMG' ? element : element.querySelector('img');
          if (!img) return null;
          return img.getAttribute('width') ? parseInt(img.getAttribute('width')!, 10) : null;
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.width) return {};
          return { width: attributes.width };
        },
      },
      height: { default: null },
      alignment: { default: 'left' },
      cropX: { default: null },
      cropY: { default: null },
      cropWidth: { default: null },
      cropHeight: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'img[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const { alignment, cropX, cropY, cropWidth, cropHeight, ...imgAttrs } = HTMLAttributes;
    const cX = cropX ?? 0;
    const cY = cropY ?? 0;
    const cW = cropWidth ?? 100;
    const cH = cropHeight ?? 100;
    const hasCrop = !(cX === 0 && cY === 0 && cW === 100 && cH === 100);

    const justifyStyle = alignment === 'center' ? 'display:flex;justify-content:center;' :
      alignment === 'right' ? 'display:flex;justify-content:end;' : '';

    if (hasCrop) {
      const imgW = `${100 / (cW / 100)}%`;
      const imgLeft = `${-(cX / cW) * 100}%`;
      const imgTop = `${-(cY / cH) * 100}%`;
      return ['div', { style: justifyStyle }, ['div', {
        style: `overflow:hidden;display:inline-block;position:relative;`,
      }, ['img', mergeAttributes({
        class: 'rounded-lg my-2',
        style: `position:absolute;width:${imgW};max-width:none;left:${imgLeft};top:${imgTop};`,
      }, imgAttrs)]]];
    }

    if (justifyStyle) {
      return ['div', { style: justifyStyle }, ['img', mergeAttributes({ class: 'rounded-lg max-w-full my-2' }, imgAttrs)]];
    }
    return ['img', mergeAttributes({ class: 'rounded-lg max-w-full my-2' }, imgAttrs)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },

  addCommands() {
    return {
      setImage:
        (options: { src: string; alt?: string; title?: string }) =>
        ({ commands }: { commands: any }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    } as any;
  },
});
