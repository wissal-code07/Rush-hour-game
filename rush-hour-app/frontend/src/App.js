import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Upload, Zap, AlertCircle, CheckCircle, Car, Truck } from 'lucide-react';
import './App.css';

const API_URL = 'http://localhost:5000/api';

const RushHourGame = () => {
  const [puzzle, setPuzzle] = useState(null);
  const [initialCSV, setInitialCSV] = useState('');
  const [moveCount, setMoveCount] = useState(0);
  const [solution, setSolution] = useState(null);
  const [solutionIndex, setSolutionIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [message, setMessage] = useState({ text: '', type: 'info' });
  const [solving, setSolving] = useState(false);
  const [apiConnected, setApiConnected] = useState(false);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('bfs');
  const [draggingVehicle, setDraggingVehicle] = useState(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [vehicleStartPos, setVehicleStartPos] = useState({ x: 0, y: 0 });

  // Afficher un message
  const showMessage = useCallback((text, type = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: 'info' }), 5000);
  }, []);

  // Vérifier la connexion à l'API
  const checkAPIConnection = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/health`);
      const data = await response.json();
      if (data.status === 'ok') {
        setApiConnected(true);
        showMessage("✅ Connecté à l'API Python", 'success');
      }
    } catch (error) {
      setApiConnected(false);
      showMessage('❌ API non disponible. Lancez le backend Python!', 'error');
    }
  }, [showMessage]);

  useEffect(() => {
    checkAPIConnection();
  }, [checkAPIConnection]);

  // Fonction pour obtenir la classe CSS du véhicule
  const getVehicleClass = (vid) => {
    if (vid === 'X') return 'vehicle vehicle-red';
    const colorMap = {
      'A': 'vehicle vehicle-blue',
      'B': 'vehicle vehicle-green',
      'C': 'vehicle vehicle-yellow',
      'D': 'vehicle vehicle-purple',
      'E': 'vehicle vehicle-pink',
      'F': 'vehicle vehicle-indigo',
      'G': 'vehicle vehicle-cyan',
      'H': 'vehicle vehicle-orange',
      'I': 'vehicle vehicle-teal',
      'J': 'vehicle vehicle-lime'
    };
    return colorMap[vid] || 'vehicle vehicle-blue';
  };

  // Charger un fichier CSV
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const csvContent = e.target.result;
      setInitialCSV(csvContent);

      try {
        showMessage('📂 Chargement du puzzle...', 'info');
        
        const response = await fetch(`${API_URL}/parse-csv`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csv: csvContent })
        });

        const data = await response.json();

        if (data.success) {
          setPuzzle(data.puzzle);
          setMoveCount(0);
          setSolution(null);
          setSolutionIndex(0);
          setAutoPlay(false);
          showMessage('✅ Puzzle chargé avec succès!', 'success');
        } else {
          showMessage(`❌ Erreur: ${data.error}`, 'error');
        }
      } catch (error) {
        showMessage('❌ Erreur de connexion à l\'API', 'error');
        console.error(error);
      }
    };
    reader.readAsText(file);
  };

  // Résoudre le puzzle
  const solvePuzzle = async (algorithm = selectedAlgorithm) => {
    if (!initialCSV) {
      showMessage('⚠️ Chargez d\'abord un fichier CSV!', 'warning');
      return;
    }

    setSolving(true);
    showMessage(`🔄 Résolution avec ${getAlgorithmName(algorithm)}...`, 'info');

    try {
      const response = await fetch(`${API_URL}/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csv: initialCSV,
          algorithm: algorithm
        })
      });

      const data = await response.json();

      if (data.success) {
        setSolution(data.solution);
        setSolutionIndex(0);
        showMessage(
          `✅ Solution trouvée! ${data.moves} mouvements (${getAlgorithmName(algorithm)})`,
          'success'
        );
      } else {
        showMessage(`❌ ${data.error}`, 'error');
      }
    } catch (error) {
      showMessage('❌ Erreur lors de la résolution', 'error');
      console.error(error);
    } finally {
      setSolving(false);
    }
  };

  // Obtenir le nom affichable de l'algorithme
  const getAlgorithmName = (algo) => {
    const names = {
      'bfs': 'BFS',
      'astar_h1': 'A* (Heuristique 1)',
      'astar_h2': 'A* (Heuristique 2)',
      'astar_h3': 'A* (Heuristique 3)'
    };
    return names[algo] || algo;
  };

  // Vérifier si le puzzle est résolu
  const isGoal = useCallback(() => {
    if (!puzzle || !puzzle.vehicles.X) return false;
    const x = puzzle.vehicles.X;
    return x.x + x.length === puzzle.width && x.y === Math.floor(puzzle.height / 2) - 1;
  }, [puzzle]);

  // Créer le plateau
  const createBoard = () => {
    if (!puzzle) return [];

    const board = Array(puzzle.height).fill(null).map(() =>
      Array(puzzle.width).fill(' ')
    );

    // Placer les murs
    puzzle.walls.forEach(([x, y]) => {
      if (y >= 0 && y < puzzle.height && x >= 0 && x < puzzle.width) {
        board[y][x] = '#';
      }
    });

    // Placer les véhicules
    Object.entries(puzzle.vehicles).forEach(([vid, data]) => {
      const { x, y, orientation, length } = data;
      for (let i = 0; i < length; i++) {
        if (orientation === 'H') {
          if (y >= 0 && y < puzzle.height && x + i >= 0 && x + i < puzzle.width) {
            board[y][x + i] = vid;
          }
        } else {
          if (y + i >= 0 && y + i < puzzle.height && x >= 0 && x < puzzle.width) {
            board[y + i][x] = vid;
          }
        }
      }
    });

    return board;
  };

  // Vérifier si un mouvement est valide
  const isValidMove = useCallback((vehicleId, newX, newY) => {
    if (!puzzle) return false;

    const vehicle = puzzle.vehicles[vehicleId];
    if (!vehicle) return false;

    const board = createBoard();
    const { orientation, length } = vehicle;

    // Vérifier les limites du plateau
    if (orientation === 'H') {
      if (newX < 0 || newX + length > puzzle.width || newY < 0 || newY >= puzzle.height) {
        return false;
      }
    } else {
      if (newY < 0 || newY + length > puzzle.height || newX < 0 || newX >= puzzle.width) {
        return false;
      }
    }

    // Vérifier les collisions avec d'autres véhicules et murs
    for (let i = 0; i < length; i++) {
      let checkX, checkY;

      if (orientation === 'H') {
        checkX = newX + i;
        checkY = newY;
      } else {
        checkX = newX;
        checkY = newY + i;
      }

      // Vérifier si la cellule est occupée par un autre véhicule (sauf celui qu'on déplace)
      if (board[checkY][checkX] !== ' ' && board[checkY][checkX] !== '#' && board[checkY][checkX] !== vehicleId) {
        return false;
      }

      // Vérifier les murs
      if (board[checkY][checkX] === '#') {
        return false;
      }
    }

    return true;
  }, [puzzle]);

  // CORRECTION : Déplacer un véhicule avec comptage simplifié
  const moveVehicle = useCallback((vehicleId, newX, newY) => {
    if (!isValidMove(vehicleId, newX, newY)) return false;

    setPuzzle(prev => {
      const newPuzzle = JSON.parse(JSON.stringify(prev));
      const vehicle = newPuzzle.vehicles[vehicleId];

      if (vehicle) {
        // Vérifier si la position a réellement changé
        const hasMoved = vehicle.x !== newX || vehicle.y !== newY;
        
        if (hasMoved) {
          vehicle.x = newX;
          vehicle.y = newY;
        }
      }

      return newPuzzle;
    });

    return true;
  }, [isValidMove]);

  // Gestionnaire de début de glissement
  const handleDragStart = useCallback((vehicleId, clientX, clientY) => {
    if (!puzzle || !puzzle.vehicles[vehicleId]) return;

    setDraggingVehicle(vehicleId);
    setDragStartPos({ x: clientX, y: clientY });
    
    const vehicle = puzzle.vehicles[vehicleId];
    setVehicleStartPos({ x: vehicle.x, y: vehicle.y });
  }, [puzzle]);

  // CORRECTION : Gestionnaire de glissement
  const handleDrag = useCallback((clientX, clientY) => {
    if (!draggingVehicle || !puzzle) return;

    const vehicle = puzzle.vehicles[draggingVehicle];
    if (!vehicle) return;

    const cellSize = Math.min(80, Math.floor(600 / Math.max(puzzle.width, puzzle.height)));
    const deltaX = clientX - dragStartPos.x;
    const deltaY = clientY - dragStartPos.y;

    // Calculer le déplacement en cases
    const cellDeltaX = Math.round(deltaX / cellSize);
    const cellDeltaY = Math.round(deltaY / cellSize);

    let newX = vehicleStartPos.x;
    let newY = vehicleStartPos.y;

    if (vehicle.orientation === 'H') {
      // Déplacement horizontal seulement
      newX = vehicleStartPos.x + cellDeltaX;
      newY = vehicleStartPos.y;
    } else {
      // Déplacement vertical seulement
      newX = vehicleStartPos.x;
      newY = vehicleStartPos.y + cellDeltaY;
    }

    // Appliquer le mouvement si valide
    moveVehicle(draggingVehicle, newX, newY);
  }, [draggingVehicle, puzzle, dragStartPos, vehicleStartPos, moveVehicle]);

  // CORRECTION : Gestionnaire de fin de glissement avec comptage
  const handleDragEnd = useCallback(() => {
    if (draggingVehicle && puzzle) {
      const vehicle = puzzle.vehicles[draggingVehicle];
      
      // Vérifier si la position a changé depuis le début du drag
      if (vehicle && (vehicle.x !== vehicleStartPos.x || vehicle.y !== vehicleStartPos.y)) {
        // Incrémenter le compteur de mouvements
        setMoveCount(prev => prev + 1);
        
        // Vérifier si le puzzle est résolu
        if (isGoal()) {
          showMessage(`🎉 Puzzle résolu en ${moveCount + 1} mouvements!`, 'success');
        }
      }
    }
    
    setDraggingVehicle(null);
  }, [draggingVehicle, puzzle, vehicleStartPos, isGoal, moveCount, showMessage]);

  // Gestionnaires d'événements de souris
  const handleMouseDown = useCallback((vehicleId, e) => {
    e.preventDefault();
    handleDragStart(vehicleId, e.clientX, e.clientY);
  }, [handleDragStart]);

  const handleMouseMove = useCallback((e) => {
    if (draggingVehicle) {
      e.preventDefault();
      handleDrag(e.clientX, e.clientY);
    }
  }, [draggingVehicle, handleDrag]);

  const handleMouseUp = useCallback(() => {
    if (draggingVehicle) {
      handleDragEnd();
    }
  }, [draggingVehicle, handleDragEnd]);

  // Gestionnaires d'événements tactiles
  const handleTouchStart = useCallback((vehicleId, e) => {
    const touch = e.touches[0];
    handleDragStart(vehicleId, touch.clientX, touch.clientY);
  }, [handleDragStart]);

  const handleTouchMove = useCallback((e) => {
    if (draggingVehicle) {
      const touch = e.touches[0];
      handleDrag(touch.clientX, touch.clientY);
    }
  }, [draggingVehicle, handleDrag]);

  const handleTouchEnd = useCallback(() => {
    if (draggingVehicle) {
      handleDragEnd();
    }
  }, [draggingVehicle, handleDragEnd]);

  // Appliquer les écouteurs d'événements globaux
  useEffect(() => {
    if (draggingVehicle) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleTouchEnd);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [draggingVehicle, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // Appliquer le prochain mouvement de la solution
  const applyNextMove = useCallback(() => {
    if (!solution || solutionIndex >= solution.length) return;

    const action = solution[solutionIndex];
    const [vid, direction, step] = action;

    setPuzzle(prev => {
      const newPuzzle = JSON.parse(JSON.stringify(prev));
      const vehicle = newPuzzle.vehicles[vid];

      if (vehicle) {
        if (direction === 'left') vehicle.x -= step || 1;
        else if (direction === 'right') vehicle.x += step || 1;
        else if (direction === 'up') vehicle.y -= step || 1;
        else if (direction === 'down') vehicle.y += step || 1;
      }

      return newPuzzle;
    });

    setMoveCount(prev => prev + 1);
    setSolutionIndex(prev => prev + 1);
  }, [solution, solutionIndex]);

  // Auto-play
  useEffect(() => {
    if (autoPlay && solution && solutionIndex < solution.length) {
      const timer = setTimeout(() => {
        applyNextMove();
      }, 500);
      return () => clearTimeout(timer);
    } else if (autoPlay && solutionIndex >= solution.length) {
      setAutoPlay(false);
      if (isGoal()) {
        showMessage(`🎉 Puzzle résolu en ${moveCount} mouvements!`, 'success');
      }
    }
  }, [autoPlay, solutionIndex, solution, applyNextMove, isGoal, moveCount, showMessage]);

  // Reset
  const resetGame = async () => {
    if (!initialCSV) return;

    try {
      const response = await fetch(`${API_URL}/parse-csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: initialCSV })
      });

      const data = await response.json();

      if (data.success) {
        setPuzzle(data.puzzle);
        setMoveCount(0);
        setSolution(null);
        setSolutionIndex(0);
        setAutoPlay(false);
        showMessage('🔄 Jeu réinitialisé', 'success');
      }
    } catch (error) {
      showMessage('❌ Erreur lors de la réinitialisation', 'error');
    }
  };

  // Étape manuelle de la solution
  const stepSolution = () => {
    if (solution && solutionIndex < solution.length) {
      applyNextMove();
    }
  };

  const board = createBoard();
  const cellSize = puzzle ? Math.min(80, Math.floor(600 / Math.max(puzzle.width, puzzle.height))) : 80;
  const progress = solution ? (solutionIndex / solution.length) * 100 : 0;

  return (
    <div className="rush-hour-container">
      {/* Header */}
      <header className="game-header">
        <div className="header-content">
          <div className="title-section">
            <Car className="header-icon" size={48} />
            <h1 className="game-title">Rush Hour Solver</h1>
            <p className="game-subtitle">Déplacez la voiture rouge vers la sortie en évitant les obstacles</p>
          </div>
          
          {/* Status API */}
          <div className={`api-status ${apiConnected ? 'connected' : 'disconnected'}`}>
            {apiConnected ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            <span>{apiConnected ? 'API Connectée' : 'API Déconnectée'}</span>
          </div>
        </div>
      </header>

      {/* Message Toast */}
      {message.text && (
        <div className={`message-toast ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="game-layout">
        {/* Section principale : Plateau + Contrôles */}
        <div className="main-content">
          {/* Plateau de jeu */}
          <div className="game-board-section">
            <div className="section-header">
              <h2>Plateau de Jeu</h2>
              {puzzle && (
                <div className="board-info">
                  <span>{puzzle.width}×{puzzle.height}</span>
                  <span>{Object.keys(puzzle.vehicles).length} véhicules</span>
                  <span className="drag-hint">💡 Glissez-déposez les véhicules pour les déplacer</span>
                </div>
              )}
            </div>
            
            <div className="game-board-container">
              {puzzle ? (
                <>
                  <div
                    className="game-board"
                    style={{
                      width: puzzle.width * cellSize,
                      height: puzzle.height * cellSize
                    }}
                  >
                    {/* Grille */}
                    {board.map((row, y) =>
                      row.map((cell, x) => (
                        <div
                          key={`${x}-${y}`}
                          className={`grid-cell ${cell === '#' ? 'wall-cell' : ''}`}
                          style={{
                            left: x * cellSize,
                            top: y * cellSize,
                            width: cellSize,
                            height: cellSize,
                          }}
                        />
                      ))
                    )}

                    {/* Sortie */}
                    <div
                      className="exit-arrow"
                      style={{
                        right: -cellSize / 3,
                        top: (Math.floor(puzzle.height / 2) - 1) * cellSize + cellSize / 2 - 15,
                        width: cellSize / 2,
                        height: cellSize / 2,
                      }}
                    >
                      🚪
                    </div>

                    {/* Véhicules */}
                    {Object.entries(puzzle.vehicles).map(([vid, data]) => {
                      const { x, y, orientation, length } = data;
                      const width = orientation === 'H' ? length * cellSize : cellSize;
                      const height = orientation === 'V' ? length * cellSize : cellSize;

                      // Déterminer l'icône en fonction de la longueur et de l'ID
                      const renderIcon = () => {
                        if (vid === 'X') {
                          return <Car className="vehicle-icon red-icon" size={cellSize * 0.6} />;
                        } else if (length === 2) {
                          return <Car className="vehicle-icon" size={cellSize * 0.6} />;
                        } else if (length === 3) {
                          return <Truck className="vehicle-icon" size={cellSize * 0.6} />;
                        }
                        return <Car className="vehicle-icon" size={cellSize * 0.6} />;  // Fallback
                      };

                      return (
                        <div
                          key={vid}
                          className={`${getVehicleClass(vid)} ${draggingVehicle === vid ? 'dragging' : ''}`}
                          style={{
                            left: x * cellSize,
                            top: y * cellSize,
                            width,
                            height,
                            cursor: 'grab',
                          }}
                          onMouseDown={(e) => handleMouseDown(vid, e)}
                          onTouchStart={(e) => handleTouchStart(vid, e)}
                        >
                          {renderIcon()}
                        </div>
                      );
                    })}
                  </div>

                  {/* Message de victoire */}
                  {isGoal() && (
                    <div className="victory-message victory-animation">
                      <div className="victory-title">🎉 Félicitations !</div>
                      <div className="victory-subtitle">Puzzle résolu en {moveCount} mouvements</div>
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-board">
                  <Upload size={64} className="empty-board-icon" />
                  <h3>Commencez par charger un puzzle</h3>
                  <p>Sélectionnez un fichier CSV pour démarrer le jeu</p>
                </div>
              )}
            </div>
          </div>

          {/* Panneau de contrôle */}
          <div className="control-panel">
            <div className="panel-header">
              <h2>Contrôles</h2>
              {puzzle && (
                <div className="move-counter">
                  <span className="move-count">{moveCount}</span>
                  <span>mouvements</span>
                </div>
              )}
            </div>

            {/* Upload Section */}
            <div className="control-section">
              <h3>Charger un Puzzle</h3>
              <label className="btn btn-file btn-large">
                <Upload size={20} />
                Sélectionner un fichier CSV
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Game Controls */}
            {puzzle && (
              <div className="control-section">
                <h3>Actions du Jeu</h3>
                <div className="button-group">
                  <button
                    onClick={resetGame}
                    className="btn btn-secondary"
                  >
                    <RotateCcw size={18} />
                    Réinitialiser
                  </button>
                  
                  {solution && (
                    <>
                      <button
                        onClick={stepSolution}
                        disabled={solutionIndex >= solution.length}
                        className="btn btn-primary"
                      >
                        <Play size={18} />
                        Étape Suivante
                      </button>
                      
                      <button
                        onClick={() => setAutoPlay(!autoPlay)}
                        disabled={solutionIndex >= solution.length}
                        className={`btn ${autoPlay ? 'btn-danger' : 'btn-primary'}`}
                      >
                        {autoPlay ? <Pause size={18} /> : <Play size={18} />}
                        {autoPlay ? 'Pause' : 'Lecture Auto'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Solving Section */}
            {puzzle && (
              <div className="control-section">
                <h3>Résolution Automatique</h3>
                
                <div className="algorithm-selector">
                  <label>Algorithme :</label>
                  <select 
                    value={selectedAlgorithm} 
                    onChange={(e) => setSelectedAlgorithm(e.target.value)}
                    className="algorithm-select"
                  >
                    <option value="bfs">Breadth-First Search (BFS)</option>
                    <option value="astar_h1">A* Search (Heuristique 1)</option>
                    <option value="astar_h2">A* Search (Heuristique 2)</option>
                    <option value="astar_h3">A* Search (Heuristique 3)</option>
                  </select>
                </div>

                <button
                  onClick={() => solvePuzzle()}
                  disabled={solving || !apiConnected}
                  className="btn btn-success btn-large"
                >
                  <Zap size={20} />
                  {solving ? 'Résolution en cours...' : `Résoudre (${getAlgorithmName(selectedAlgorithm)})`}
                </button>

                {/* Progress Bar */}
                {solution && (
                  <div className="progress-section">
                    <div className="progress-info">
                      <span>Progression de la solution</span>
                      <span>{solutionIndex}/{solution.length}</span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div> {/* end main-content */}
      </div> {/* end game-layout */}
    </div> /* end rush-hour-container */
  );
};

export default RushHourGame;