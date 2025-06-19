import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Type, Download, Trash2, Eye, EyeOff, Copy, RefreshCw, Layers, Palette, Text, RotateCcw, ChevronDown, Move } from 'lucide-react';
import ClarityAnalytics from './ClarityAnalytics';

const ImageTextEditor = () => {
  const [originalImage, setOriginalImage] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const [textElements, setTextElements] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [draggedElement, setDraggedElement] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [activeMobilePopup, setActiveMobilePopup] = useState(null);

  const fileInputRef = useRef(null);
  const containerRef = useRef(null);
  const selectedTextRef = useRef(null);
  const mobileToolbarRef = useRef(null);
  const savedSelection = useRef(null);
  const [isDragInitiationAttempt, setIsDragInitiationAttempt] = useState(false);
  const initialPointerPos = useRef({ x: 0, y: 0 });
  const DRAG_THRESHOLD = 5;

  const saveSelection = useCallback(() => {
    if (selectedTextRef.current) {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(selectedTextRef.current);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        const caretOffset = preCaretRange.toString().length;
        
        savedSelection.current = {
          startOffset: range.startOffset,
          endOffset: range.endOffset,
          node: range.endContainer,
          caretOffset: caretOffset
        };
      }
    }
  }, []);

  const restoreSelection = useCallback(() => {
    if (savedSelection.current && selectedTextRef.current) {
      const selection = window.getSelection();
      const range = document.createRange();
      const targetNode = selectedTextRef.current;
      
      let charCount = 0;
      let foundNode = null;

      function traverseNodes(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          if (charCount + node.length >= savedSelection.current.caretOffset) {
            foundNode = node;
            range.setStart(foundNode, savedSelection.current.caretOffset - charCount);
            range.setEnd(foundNode, savedSelection.current.caretOffset - charCount);
            return true;
          }
          charCount += node.length;
        } else if (node.nodeType === Node.ELEMENT_NODE && node.childNodes) {
          for (let i = 0; i < node.childNodes.length; i++) {
            if (traverseNodes(node.childNodes[i])) {
              return true;
            }
          }
        }
        return false;
      }

      if (!traverseNodes(targetNode)) {
        range.selectNodeContents(targetNode);
        range.collapse(false);
      }
      
      selection.removeAllRanges();
      selection.addRange(range);
    }
    savedSelection.current = null;
  }, []);


  const removeBackground = async (imageData) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        const threshold = 50;
        const backgroundSamples = [
          [0, 0], [canvas.width - 1, 0],
          [0, canvas.height - 1], [canvas.width - 1, canvas.height - 1]
        ];

        let avgR = 0, avgG = 0, avgB = 0;
        backgroundSamples.forEach(([x, y]) => {
          const idx = (y * canvas.width + x) * 4;
          avgR += data[idx];
          avgG += data[idx + 1];
          avgB += data[idx + 2];
        });
        avgR /= backgroundSamples.length;
        avgG /= backgroundSamples.length;
        avgB /= backgroundSamples.length;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          const diff = Math.sqrt(
            Math.pow(r - avgR, 2) +
            Math.pow(g - avgG, 2) +
            Math.pow(b - avgB, 2)
          );

          if (diff < threshold) {
            data[i + 3] = 0;
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL());
      };

      img.src = imageData;
    });
  };

  const processImage = async (imageData) => {
    setIsProcessing(true);
    setProcessingStep('Analyzing image...');

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setProcessingStep('Removing background...');
      const processedImageData = await removeBackground(imageData);
      setProcessedImage(processedImageData);
      setProcessingStep('Complete!');
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Processing failed:', error);
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageData = event.target.result;
        setOriginalImage(imageData);
        setProcessedImage(null);
        setTextElements([]);
        processImage(imageData);
        setActiveMobilePopup(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const addTextElement = () => {
    const newElement = {
      id: Date.now(),
      text: 'Behind Text',
      x: 50,
      y: 50,
      fontSize: 48,
      fontFamily: 'Impact',
      color: '#000000',
      stroke: '#ffffff',
      strokeWidth: 2,
      opacity: 1,
      rotation: 0,
      visible: true,
      shadow: true,
      shadowColor: '#000000',
      shadowBlur: 10,
      shadowOffsetX: 2,
      shadowOffsetY: 2,
      letterSpacing: 0,
      lineHeight: 1.2,
      textTransform: 'none',
      gradient: false,
      gradientColors: ['#ff0000', '#0000ff']
    };
    setTextElements([...textElements, newElement]);
    setSelectedElement(newElement.id);
    setActiveMobilePopup(null);
  };

  const updateTextElement = useCallback((id, updates) => {
    setTextElements(prev =>
      prev.map(el => el.id === id ? { ...el, ...updates } : el)
    );
  }, []);

  const deleteTextElement = (id) => {
    setTextElements(prev => prev.filter(el => el.id !== id));
    setSelectedElement(null);
    setActiveMobilePopup(null);
  };

  const duplicateTextElement = (id) => {
    const element = textElements.find(el => el.id === id);
    if (element) {
      const newElement = {
        ...element,
        id: Date.now(),
        x: element.x + 20,
        y: element.y + 20
      };
      setTextElements([...textElements, newElement]);
      setSelectedElement(newElement.id);
      setActiveMobilePopup(null);
    }
  };

  const handlePointerDown = (e, elementId) => {
    setSelectedElement(elementId);
    setActiveMobilePopup(null);
    e.stopPropagation(); 

    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

    initialPointerPos.current = { x: clientX, y: clientY };
    setIsDragInitiationAttempt(true);

    const rect = containerRef.current.getBoundingClientRect();
    const element = textElements.find(el => el.id === elementId);

    if (!element) return;

    setDragOffset({
      x: clientX - rect.left - element.x,
      y: clientY - rect.top - element.y
    });
  };

  const handlePointerMove = (e) => {
    if (!isDragInitiationAttempt && !draggedElement) {
      return;
    }

    const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

    if (isDragInitiationAttempt && !draggedElement) {
      const distance = Math.sqrt(
        Math.pow(clientX - initialPointerPos.current.x, 2) +
        Math.pow(clientY - initialPointerPos.current.y, 2)
      );

      if (distance > DRAG_THRESHOLD) {
        setDraggedElement(selectedElement);
        e.preventDefault();
      } else {
        return;
      }
    }

    if (draggedElement && containerRef.current) {
      e.preventDefault();

      const rect = containerRef.current.getBoundingClientRect();
      const element = textElements.find(el => el.id === draggedElement);
      
      let elementWidth = selectedTextRef.current ? selectedTextRef.current.offsetWidth : (element.fontSize * element.text.length * 0.6 || 50);
      let elementHeight = selectedTextRef.current ? selectedTextRef.current.offsetHeight : (element.fontSize * 1.2 || 50);

      const newX = Math.max(0, Math.min(rect.width - elementWidth, clientX - rect.left - dragOffset.x));
      const newY = Math.max(0, Math.min(rect.height - elementHeight, clientY - rect.top - dragOffset.y));

      updateTextElement(draggedElement, { x: newX, y: newY });
    }
  };

  const handlePointerUp = () => {
    setIsDragInitiationAttempt(false);
    setDraggedElement(null);
  };

  const getImageDimensions = () => {
    if (!originalImage || !containerRef.current) return null;

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const containerRect = containerRef.current.getBoundingClientRect();
        const imageAspectRatio = img.width / img.height;
        const containerAspectRatio = containerRect.width / containerRect.height;

        let displayedWidth, displayedHeight, offsetX, offsetY;

        if (imageAspectRatio > containerAspectRatio) {
          displayedWidth = containerRect.width;
          displayedHeight = displayedWidth / imageAspectRatio;
          offsetX = 0;
          offsetY = (containerRect.height - displayedHeight) / 2;
        } else {
          displayedHeight = containerRect.height;
          displayedWidth = displayedHeight * imageAspectRatio;
          offsetY = 0;
          offsetX = (containerRect.width - displayedWidth) / 2;
        }

        resolve({
          actualWidth: img.width,
          actualHeight: img.height,
          displayedWidth,
          displayedHeight,
          offsetX,
          offsetY,
          scaleX: img.width / displayedWidth,
          scaleY: img.height / displayedHeight
        });
      };
      img.src = originalImage;
    });
  };

  const downloadImage = async () => {
    if (!originalImage || !processedImage) {
      return;
    }

    const prevActivePopup = activeMobilePopup;
    setActiveMobilePopup(null);
    const prevSelected = selectedElement;
    setSelectedElement(null);
    await new Promise(resolve => setTimeout(resolve, 50));

    const dimensions = await getImageDimensions();
    if (!dimensions) {
      setActiveMobilePopup(prevActivePopup);
      setSelectedElement(prevSelected);
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const originalImg = new Image();

    originalImg.onload = () => {
      canvas.width = originalImg.width;
      canvas.height = originalImg.height;
      ctx.drawImage(originalImg, 0, 0);

      textElements.filter(el => el.visible).forEach(element => {
        ctx.save();
        const adjustedScaleX = dimensions.scaleX;
        const adjustedScaleY = dimensions.scaleY;
        const scaledFontSize = element.fontSize * adjustedScaleY;

        ctx.font = `${scaledFontSize}px ${element.fontFamily}`;
        ctx.globalAlpha = element.opacity;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.letterSpacing = `${element.letterSpacing * adjustedScaleX}px`;
        
        const canvasX = (element.x - dimensions.offsetX) * adjustedScaleX;
        const canvasY = (element.y - dimensions.offsetY) * adjustedScaleY;

        const tempCtx = document.createElement('canvas').getContext('2d');
        tempCtx.font = ctx.font;
        tempCtx.letterSpacing = ctx.letterSpacing;
        const textMetrics = tempCtx.measureText(element.text);
        const centerX = canvasX + textMetrics.width / 2;
        const centerY = canvasY + scaledFontSize / 2;

        if (element.rotation !== 0) {
          ctx.translate(centerX, centerY);
          ctx.rotate((element.rotation * Math.PI) / 180);
          ctx.translate(-centerX, -centerY);
        }

        if (element.shadow) {
          ctx.shadowColor = element.shadowColor;
          ctx.shadowBlur = element.shadowBlur * adjustedScaleY;
          ctx.shadowOffsetX = element.shadowOffsetX * adjustedScaleX;
          ctx.shadowOffsetY = element.shadowOffsetY * adjustedScaleY;
        }

        if(element.gradient){
          const gradient = ctx.createLinearGradient(canvasX, canvasY, canvasX + textMetrics.width, canvasY);
          gradient.addColorStop(0, element.gradientColors[0]);
          gradient.addColorStop(1, element.gradientColors[1]);
          ctx.fillStyle = gradient;
        } else {
          ctx.fillStyle = element.color;
        }
        
        let textToRender = element.text;
        if(element.textTransform === 'uppercase') textToRender = textToRender.toUpperCase();
        if(element.textTransform === 'lowercase') textToRender = textToRender.toLowerCase();
        if(element.textTransform === 'capitalize') textToRender = textToRender.replace(/\b\w/g, char => char.toUpperCase());

        ctx.fillText(textToRender, canvasX, canvasY);

        if (element.strokeWidth > 0) {
          ctx.shadowColor = 'transparent';
          ctx.strokeStyle = element.stroke;
          ctx.lineWidth = element.strokeWidth * adjustedScaleY;
          ctx.strokeText(textToRender, canvasX, canvasY);
        }

        ctx.restore();
      });

      const processedImg = new Image();
      processedImg.onload = () => {
        ctx.drawImage(processedImg, 0, 0, originalImg.width, originalImg.height);
        const link = document.createElement('a');
        link.download = 'edited-image.png';
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
        setActiveMobilePopup(prevActivePopup);
        setSelectedElement(prevSelected);
      };
      processedImg.src = processedImage;
    };
    originalImg.src = originalImage;
  };

  const selectedElementData = textElements.find(el => el.id === selectedElement);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const isClickInsideSelectedText = selectedTextRef.current && selectedTextRef.current.contains(event.target);
      const isClickInsideMobileToolbar = mobileToolbarRef.current && mobileToolbarRef.current.contains(event.target);
      
      if (!isClickInsideSelectedText && !isClickInsideMobileToolbar) {
        setSelectedElement(null);
        setActiveMobilePopup(null);
      }
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointerdown', handleClickOutside);

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [draggedElement, dragOffset, textElements, selectedElement, updateTextElement, activeMobilePopup, isDragInitiationAttempt]);

  const handleTextContentInput = (e, id) => {
    saveSelection();
    if (e.target.innerText !== selectedElementData.text) {
      updateTextElement(id, { text: e.target.innerText });
    }
  };

  useEffect(() => {
    if (selectedElement && savedSelection.current) {
      restoreSelection();
    }
  }, [textElements, selectedElement, restoreSelection]);

  const toggleMobilePopup = (popupName) => {
    setActiveMobilePopup(activeMobilePopup === popupName ? null : popupName);
  };
  
  const fontOptions = [
    'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana', 'Impact',
    'Montserrat', 'Playfair Display', 'Lobster', 'Roboto', 'Poppins', 'Oswald', 'Lato', 'Raleway'
  ];

  const renderTextProperties = (isMobile) => {
    if(!selectedElementData) return null;

    const textStyle = {
      textTransform: selectedElementData.textTransform || 'none'
    };
    
    return (
      <div className={`space-y-4 ${isMobile ? 'p-6 pt-8' : ''}`}>
         {isMobile && <h3 className="font-bold mb-4 text-center text-xl bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Text Properties</h3>}
        <div>
          <label className="block text-sm font-medium mb-1">Font Family</label>
          <select value={selectedElementData.fontFamily} onChange={(e) => updateTextElement(selectedElement, { fontFamily: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2">
            {fontOptions.map(font => <option key={font} value={font}>{font}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Font Size: {selectedElementData.fontSize}px</label>
          <input type="range" min="12" max="250" value={selectedElementData.fontSize} onChange={(e) => updateTextElement(selectedElement, { fontSize: parseInt(e.target.value) })} className="w-full accent-blue-400" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Color</label>
            <input type="color" value={selectedElementData.color} onChange={(e) => updateTextElement(selectedElement, { color: e.target.value })} className="w-full h-10 p-1 bg-gray-700 border border-gray-600 rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Outline</label>
            <input type="color" value={selectedElementData.stroke} onChange={(e) => updateTextElement(selectedElement, { stroke: e.target.value })} className="w-full h-10 p-1 bg-gray-700 border border-gray-600 rounded-md" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Outline Width: {selectedElementData.strokeWidth}px</label>
          <input type="range" min="0" max="20" value={selectedElementData.strokeWidth} onChange={(e) => updateTextElement(selectedElement, { strokeWidth: parseInt(e.target.value) })} className="w-full accent-blue-400" />
        </div>
      </div>
    );
  };

  const renderTextEffects = (isMobile) => {
    if(!selectedElementData) return null;
    return(
      <div className={`space-y-4 ${isMobile ? 'p-6 pt-8' : ''}`}>
        {isMobile && <h3 className="font-bold mb-4 text-center text-xl bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Text Effects</h3>}
         <div>
            <label className="block text-sm font-medium mb-1">Letter Spacing: {selectedElementData.letterSpacing}px</label>
            <input type="range" min="-10" max="50" value={selectedElementData.letterSpacing} onChange={(e) => updateTextElement(selectedElement, { letterSpacing: parseInt(e.target.value) })} className="w-full accent-cyan-400" />
          </div>
         <div>
            <label className="block text-sm font-medium mb-1">Line Height: {selectedElementData.lineHeight}</label>
            <input type="range" min="0.8" max="3" step="0.1" value={selectedElementData.lineHeight} onChange={(e) => updateTextElement(selectedElement, { lineHeight: parseFloat(e.target.value) })} className="w-full accent-cyan-400" />
          </div>
        <div>
          <label className="block text-sm font-medium mb-1">Opacity: {Math.round(selectedElementData.opacity * 100)}%</label>
          <input type="range" min="0" max="1" step="0.05" value={selectedElementData.opacity} onChange={(e) => updateTextElement(selectedElement, { opacity: parseFloat(e.target.value) })} className="w-full accent-cyan-400" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Rotation: {selectedElementData.rotation}°</label>
          <input type="range" min="-180" max="180" value={selectedElementData.rotation} onChange={(e) => updateTextElement(selectedElement, { rotation: parseInt(e.target.value) })} className="w-full accent-cyan-400" />
        </div>
        <div className="bg-gray-700 rounded-lg p-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={selectedElementData.shadow} onChange={(e) => updateTextElement(selectedElement, { shadow: e.target.checked })} className="h-4 w-4 rounded accent-cyan-400" />
            <span>Text Shadow</span>
          </label>
          {selectedElementData.shadow && (
            <div className="space-y-3 mt-3">
              <div>
                <label className="block text-sm font-medium mb-1">Shadow Color</label>
                <input type="color" value={selectedElementData.shadowColor} onChange={(e) => updateTextElement(selectedElement, { shadowColor: e.target.value })} className="w-full h-8 p-1 bg-gray-600 border border-gray-500 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Blur: {selectedElementData.shadowBlur}px</label>
                <input type="range" min="0" max="50" value={selectedElementData.shadowBlur} onChange={(e) => updateTextElement(selectedElement, { shadowBlur: parseInt(e.target.value) })} className="w-full accent-cyan-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Offset X: {selectedElementData.shadowOffsetX}px</label>
                  <input type="range" min="-25" max="25" value={selectedElementData.shadowOffsetX} onChange={(e) => updateTextElement(selectedElement, { shadowOffsetX: parseInt(e.target.value) })} className="w-full accent-cyan-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Offset Y: {selectedElementData.shadowOffsetY}px</label>
                  <input type="range" min="-25" max="25" value={selectedElementData.shadowOffsetY} onChange={(e) => updateTextElement(selectedElement, { shadowOffsetY: parseInt(e.target.value) })} className="w-full accent-cyan-400" />
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="bg-gray-700 rounded-lg p-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={selectedElementData.gradient} onChange={(e) => updateTextElement(selectedElement, { gradient: e.target.checked })} className="h-4 w-4 rounded accent-cyan-400" />
            <span>Gradient Text</span>
          </label>
          {selectedElementData.gradient && (
             <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Start</label>
                  <input type="color" value={selectedElementData.gradientColors[0]} onChange={(e) => updateTextElement(selectedElement, { gradientColors: [e.target.value, selectedElementData.gradientColors[1]] })} className="w-full h-8 p-1 bg-gray-600 border border-gray-500 rounded-md" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End</label>
                  <input type="color" value={selectedElementData.gradientColors[1]} onChange={(e) => updateTextElement(selectedElement, { gradientColors: [selectedElementData.gradientColors[0], e.target.value] })} className="w-full h-8 p-1 bg-gray-600 border border-gray-500 rounded-md" />
                </div>
              </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-900 text-white font-sans">
      <ClarityAnalytics clarityProjectId="s23euahv3w" />{" "}
      <header className="flex items-center justify-center px-4 py-4 border-b border-gray-700">
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
        BehindText
        </h1>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4 lg:pb-4 pb-[80px]">
        <div className="hidden lg:col-span-1 xl:col-span-1 bg-gray-800 rounded-lg p-4 flex-col space-y-4 lg:flex">
          <div className="space-y-4">
            <div className="bg-gray-700 rounded-lg p-3">
              <h3 className="font-medium mb-2 text-center">Upload Image</h3>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="w-full flex items-center justify-center gap-3 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed px-4 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-blue-500/30 text-lg"
              >
                <Upload size={24} />
                {isProcessing ? 'Processing...' : 'Choose Image'}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              {processingStep && (
                <div className="mt-2 text-center text-blue-200">
                  <RefreshCw size={16} className="animate-spin inline mr-2" />
                  <span className="text-sm">{processingStep}</span>
                </div>
              )}
            </div>

            {processedImage && !isProcessing && (
              <div className="bg-gray-700 rounded-lg p-3">
                <h3 className="font-medium mb-2 text-center">Add Text</h3>
                <button
                  onClick={addTextElement}
                  className="w-full flex items-center justify-center gap-3 bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 px-4 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-green-500/30 text-lg"
                >
                  <Type size={24} />
                  Add Text Element
                </button>
              </div>
            )}

            {textElements.length > 0 && (
              <div className="bg-gray-700 rounded-lg p-3">
                <h3 className="font-medium mb-2">Text Layers</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {textElements.map((element) => (
                    <div
                      key={element.id}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${selectedElement === element.id ? 'bg-blue-500' : 'bg-gray-600 hover:bg-gray-500'}`}
                      onClick={() => setSelectedElement(element.id)}
                    >
                      <button onClick={(e) => { e.stopPropagation(); updateTextElement(element.id, { visible: !element.visible }); }} className="p-1 hover:bg-white/20 rounded">
                        {element.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                      <span className="flex-1 text-sm truncate">{element.text}</span>
                      <button onClick={(e) => { e.stopPropagation(); duplicateTextElement(element.id); }} className="p-1 hover:bg-white/20 rounded">
                        <Copy size={16} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteTextElement(element.id); }} className="p-1 hover:bg-red-500/50 rounded text-red-300">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {processedImage && (
              <button
                onClick={downloadImage}
                disabled={textElements.length === 0}
                className="w-full flex items-center justify-center gap-3 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 px-4 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-emerald-500/30 text-lg"
              >
                <Download size={24} />
                Download
              </button>
            )}
          </div>
        </div>

        <div className="col-span-full lg:col-span-2 xl:col-span-3 bg-black/20 rounded-lg flex items-center justify-center p-2">
          <div
            ref={containerRef}
            className="relative w-full h-full bg-gray-800/50 rounded-lg overflow-hidden select-none"
          >
            {originalImage ? (
              <>
                <img src={originalImage} alt="Original" className="absolute inset-0 w-full h-full object-contain" draggable={false} />
                {processedImage && textElements.filter(el => el.visible).map((element) => {
                  const style = {
                    left: `${element.x}px`,
                    top: `${element.y}px`,
                    fontSize: `${element.fontSize}px`,
                    fontFamily: element.fontFamily,
                    color: element.gradient ? 'transparent' : element.color,
                    opacity: element.opacity,
                    transform: `rotate(${element.rotation}deg)`,
                    transformOrigin: 'center center',
                    zIndex: 5,
                    minWidth: '20px',
                    minHeight: `${element.fontSize}px`,
                    textShadow: element.shadow ? `${element.shadowOffsetX}px ${element.shadowOffsetY}px ${element.shadowBlur}px ${element.shadowColor}` : 'none',
                    WebkitTextStroke: element.strokeWidth > 0 ? `${element.strokeWidth}px ${element.stroke}` : 'none',
                    cursor: selectedElement === element.id ? 'text' : 'grab',
                    touchAction: 'none',
                    letterSpacing: `${element.letterSpacing}px`,
                    lineHeight: element.lineHeight,
                    textTransform: element.textTransform,
                  };
                   if(element.gradient){
                      style.backgroundImage = `linear-gradient(to right, ${element.gradientColors[0]}, ${element.gradientColors[1]})`;
                      style.backgroundClip = 'text';
                      style.WebkitBackgroundClip = 'text';
                   }

                  return (
                    <div
                      key={element.id}
                      ref={selectedElement === element.id ? selectedTextRef : null}
                      contentEditable={selectedElement === element.id}
                      onInput={(e) => handleTextContentInput(e, element.id)}
                      suppressContentEditableWarning={true}
                      className={`absolute select-none p-1 leading-none flex items-center justify-center whitespace-pre ${selectedElement === element.id ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-black/50 rounded-md outline-none' : ''}`}
                      style={style}
                      onPointerDown={(e) => handlePointerDown(e, element.id)}
                    >
                      {element.text}
                    </div>
                  );
                 })}
                {processedImage && <img src={processedImage} alt="Processed" className="absolute inset-0 w-full h-full object-contain pointer-events-none" style={{ zIndex: 10 }} draggable={false} />}
                {isProcessing && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-20">
                    <div className="bg-white/90 rounded-lg p-6 text-center text-gray-800 shadow-2xl">
                      <RefreshCw size={32} className="animate-spin mx-auto mb-3 text-blue-600" />
                      <p className="font-medium">{processingStep}</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div
                className="flex items-center justify-center h-full text-gray-400 cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="text-center p-8 border-4 border-dashed border-gray-600 group-hover:border-blue-500 group-hover:bg-gray-800/50 rounded-2xl transition-all duration-300">
                  <Upload size={64} className="mx-auto mb-4 opacity-50 group-hover:opacity-100 group-hover:text-blue-400 transition-all duration-300" />
                  <p className="text-xl font-semibold">Upload an image to start</p>
                  <p className="text-gray-500">Click here to choose a file</p>
                </div>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </div>
        </div>

        <div className="hidden lg:col-span-1 xl:col-span-1 bg-gray-800 rounded-lg p-4 flex-col space-y-4 lg:flex">
          <h2 className="text-lg font-semibold mb-2">Text Properties</h2>
          {selectedElementData ? (
             <>
              {renderTextProperties(false)}
              <h2 className="text-lg font-semibold mb-2 mt-4">Effects</h2>
              {renderTextEffects(false)}
             </>
          ) : (
            <div className="text-center text-gray-400 py-8">
              <Type size={48} className="mx-auto mb-4 opacity-50" />
              <p>Select a text layer to edit its properties.</p>
            </div>
          )}
        </div>
      </div>

     {originalImage && (
      <div ref={mobileToolbarRef} className="fixed bottom-0 left-0 right-0 lg:hidden bg-gradient-to-t from-gray-900/95 to-gray-800/95 backdrop-blur-xl border-t border-gray-600/50 rounded-t-2xl z-40 shadow-2xl">
        <div className="w-12 h-1 bg-gradient-to-r from-purple-400 to-cyan-400 rounded-full mx-auto mt-2 opacity-60"></div>
        <div className="flex justify-around items-center h-[70px] px-2 py-2">
           <button onClick={() => fileInputRef.current?.click()} className="group flex items-center justify-center w-14 h-14 text-gray-300 hover:text-white bg-gradient-to-br from-gray-700/80 to-gray-800/80 hover:from-orange-600/70 hover:to-orange-700/70 rounded-2xl transition-all duration-300 ease-out mx-1 shadow-lg hover:shadow-xl hover:shadow-orange-500/20 backdrop-blur-sm border border-gray-600/30 hover:border-orange-500/40 hover:scale-105 active:scale-95" title="Re-upload Image">
            <div className="relative">
              <RotateCcw size={24} className="transition-transform duration-300 group-hover:scale-110" />
            </div>
          </button>
          <button onClick={addTextElement} className="group flex items-center justify-center w-14 h-14 text-gray-300 hover:text-white bg-gradient-to-br from-gray-700/80 to-gray-800/80 hover:from-green-600/70 hover:to-green-700/70 rounded-2xl transition-all duration-300 ease-out mx-1 shadow-lg hover:shadow-xl hover:shadow-green-500/20 backdrop-blur-sm border border-gray-600/30 hover:border-green-500/40 hover:scale-105 active:scale-95" title="Add Text">
            <div className="relative">
              <Type size={24} className="transition-transform duration-300 group-hover:scale-110" />
              <div className="absolute inset-0 bg-green-400/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </div>
          </button>
          <button onClick={() => toggleMobilePopup('layers')} className={`group flex items-center justify-center w-14 h-14 transition-all duration-300 ease-out rounded-2xl mx-1 shadow-lg backdrop-blur-sm border hover:scale-105 active:scale-95 relative ${activeMobilePopup === 'layers' ? 'text-blue-100 bg-gradient-to-br from-blue-500/80 to-blue-600/80 border-blue-400/50 shadow-xl shadow-blue-500/30' : 'text-gray-300 hover:text-white bg-gradient-to-br from-gray-700/80 to-gray-800/80 hover:from-blue-600/60 hover:to-blue-700/60 border-gray-600/30 hover:border-blue-500/40 hover:shadow-xl hover:shadow-blue-500/15'}`} title="Text Layers">
            <div className="relative">
              <Layers size={24} className="transition-transform duration-300 group-hover:scale-110" />
              {activeMobilePopup === 'layers' && (<div className="absolute inset-0 bg-blue-300/30 rounded-full blur-lg"></div>)}
              {textElements.length > 0 && (<div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-gray-800">{textElements.length}</div>)}
            </div>
          </button>
          <button onClick={() => toggleMobilePopup('font')} className={`group flex items-center justify-center w-14 h-14 transition-all duration-300 ease-out rounded-2xl mx-1 shadow-lg backdrop-blur-sm border hover:scale-105 active:scale-95 ${!selectedElementData ? 'opacity-40 cursor-not-allowed' : ''} ${activeMobilePopup === 'font' ? 'text-purple-100 bg-gradient-to-br from-purple-500/80 to-purple-600/80 border-purple-400/50 shadow-xl shadow-purple-500/30' : 'text-gray-300 hover:text-white bg-gradient-to-br from-gray-700/80 to-gray-800/80 hover:from-purple-600/60 hover:to-purple-700/60 border-gray-600/30 hover:border-purple-500/40 hover:shadow-xl hover:shadow-purple-500/15'}`} title="Font Properties" disabled={!selectedElementData}>
            <div className="relative">
              <Text size={24} className="transition-transform duration-300 group-hover:scale-110" />
              {activeMobilePopup === 'font' && (<div className="absolute inset-0 bg-purple-300/30 rounded-full blur-lg"></div>)}
            </div>
          </button>
          <button onClick={() => toggleMobilePopup('effects')} className={`group flex items-center justify-center w-14 h-14 transition-all duration-300 ease-out rounded-2xl mx-1 shadow-lg backdrop-blur-sm border hover:scale-105 active:scale-95 ${!selectedElementData ? 'opacity-40 cursor-not-allowed' : ''} ${activeMobilePopup === 'effects' ? 'text-cyan-100 bg-gradient-to-br from-cyan-500/80 to-cyan-600/80 border-cyan-400/50 shadow-xl shadow-cyan-500/30' : 'text-gray-300 hover:text-white bg-gradient-to-br from-gray-700/80 to-gray-800/80 hover:from-cyan-600/60 hover:to-cyan-700/60 border-gray-600/30 hover:border-cyan-500/40 hover:shadow-xl hover:shadow-cyan-500/15'}`} title="Text Effects" disabled={!selectedElementData}>
            <div className="relative">
              <Palette size={24} className="transition-transform duration-300 group-hover:scale-110" />
              {activeMobilePopup === 'effects' && (<div className="absolute inset-0 bg-cyan-300/30 rounded-full blur-lg"></div>)}
            </div>
          </button>
           <button onClick={downloadImage} disabled={textElements.length === 0} className="group flex items-center justify-center w-14 h-14 text-white bg-gradient-to-br from-emerald-500/90 to-emerald-600/90 hover:from-emerald-400/90 hover:to-emerald-500/90 rounded-2xl transition-all duration-300 ease-out mx-1 shadow-lg hover:shadow-xl hover:shadow-emerald-500/30 backdrop-blur-sm border border-emerald-400/40 hover:border-emerald-300/60 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 hover:scale-105 active:scale-95" title="Download Image">
            <div className="relative">
              <Download size={24} className="transition-transform duration-300 group-hover:scale-110" />
              <div className="absolute inset-0 bg-white/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </div>
          </button>
        </div>

        {activeMobilePopup && (
          <div className="absolute bottom-[80px] left-2 right-2 bg-gradient-to-b from-gray-800/95 to-gray-900/95 backdrop-blur-xl border border-gray-600/50 rounded-2xl shadow-2xl max-h-[calc(70vh-80px)] overflow-y-auto transform transition-all duration-400 ease-out z-50">
            <button onClick={() => setActiveMobilePopup(null)} className="absolute top-3 right-3 p-2 text-gray-300 hover:text-white hover:bg-gray-600/50 rounded-full transition-all duration-200 backdrop-blur-sm border border-gray-600/30 hover:border-gray-500/50" title="Close">
              <ChevronDown size={20} />
            </button>
              {activeMobilePopup === 'layers' && (
                  <div className="p-6 pt-8">
                    <h3 className="font-bold mb-4 text-center text-xl bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Text Layers</h3>
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                      {textElements.length > 0 ? (
                        textElements.map((element) => (
                          <div key={element.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 backdrop-blur-sm border ${selectedElement === element.id ? 'bg-gradient-to-r from-blue-500/40 to-blue-600/40 border-blue-400/50 shadow-lg shadow-blue-500/20' : 'bg-gray-700/60 hover:bg-gray-600/60 border-gray-600/30 hover:border-gray-500/50'}`} onClick={() => { setSelectedElement(element.id); }}>
                            <button onClick={(e) => { e.stopPropagation(); updateTextElement(element.id, { visible: !element.visible }); }} className="p-2 hover:bg-white/20 rounded-lg transition-colors duration-200">{element.visible ? <Eye size={16} /> : <EyeOff size={16} />}</button>
                            <span className="flex-1 text-sm font-medium truncate">{element.text}</span>
                            <button onClick={(e) => { e.stopPropagation(); duplicateTextElement(element.id); }} className="p-2 hover:bg-white/20 rounded-lg transition-colors duration-200"><Copy size={16} /></button>
                            <button onClick={(e) => { e.stopPropagation(); deleteTextElement(element.id); }} className="p-2 hover:bg-red-500/30 rounded-lg text-red-300 hover:text-red-200 transition-colors duration-200"><Trash2 size={16} /></button>
                          </div>
                        ))
                      ) : (<div className="text-center text-gray-400 py-8"><Layers size={48} className="mx-auto mb-4 opacity-50" /><p className="text-sm">No text layers yet.</p></div>)}
                    </div>
                  </div>
              )}
              {activeMobilePopup === 'font' && renderTextProperties(true)}
              {activeMobilePopup === 'effects' && renderTextEffects(true)}
              {(activeMobilePopup === 'font' || activeMobilePopup === 'effects') && !selectedElementData && (<div className="text-center text-gray-400 py-12"><div className="relative"><Type size={64} className="mx-auto mb-6 opacity-30" /><div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-cyan-400/20 rounded-full blur-2xl"></div></div><p className="text-lg font-medium">Select a text layer to edit.</p></div>)}
          </div>
        )}
      </div>
     )}
    </div>
  );
};

export default ImageTextEditor;
