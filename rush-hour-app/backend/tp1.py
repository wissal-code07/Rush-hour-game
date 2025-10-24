import csv
from collections import deque
import heapq
import itertools
import time

class Vehicule:
    def __init__(self, id, x, y, orientation, length):
        self.id = id
        self.x = x
        self.y = y
        self.orientation = orientation
        self.length = length

class RushHourPuzzle:
    def __init__(self):
        self.board_height = 0
        self.board_width = 0
        self.vehicles = {}  # dictionnaire {id: {'x':x, 'y':y', 'orientation':o, 'length':L}}
        self.walls = []     # liste [(x, y)]
        self.board = []     # matrice (liste de listes)

    def __eq__(self, other):
        """Vérifie si deux états sont identiques"""
        if not isinstance(other, RushHourPuzzle):
            return False
        return self.vehicles == other.vehicles

    def __hash__(self):
        """Génère un hash unique pour chaque configuration"""
        items = tuple(sorted(
            (vid, data['x'], data['y'], data['orientation'], data['length'])
            for vid, data in self.vehicles.items()
        ))
        return hash(items)

    def __repr__(self):
        """Représentation textuelle pour le débogage"""
        return f"RushHour({self.vehicles})"

    def setVehicles(self, csv_file):
        """Lit le fichier CSV et initialise les véhicules et les murs"""
        with open(csv_file, 'r') as f:
            lecture = csv.reader(f)
            rows = list(lecture)

        self.board_height, self.board_width = map(int, rows[0])

        for row in rows[1:]:
            if not row:
                continue
            if row[0] == '#':  # c’est un mur
                self.walls.append((int(row[1]), int(row[2])))
            else:
                vid, x, y, orientation, length = row
                self.vehicles[vid] = {
                    'x': int(x),
                    'y': int(y),
                    'orientation': orientation,
                    'length': int(length)
                }

    def setBoard(self):
        """Crée la matrice du plateau et place les véhicules et murs"""
        self.board = [[' ' for _ in range(self.board_width)] for _ in range(self.board_height)]

        # Placer les murs
        for (x, y) in self.walls:
            if 0 <= y < self.board_height and 0 <= x < self.board_width:
                self.board[y][x] = '#'

        # Placer les véhicules
        for vid, data in self.vehicles.items():
            x, y, o, l = data['x'], data['y'], data['orientation'], data['length']
            for i in range(l):
                if o == 'H':
                    self.board[y][x + i] = vid
                else:
                    self.board[y + i][x] = vid

    def isGoal(self):
        """Vérifie si la voiture rouge X est à la sortie"""
        if 'X' not in self.vehicles:
            return False
        x = self.vehicles['X']['x']
        y = self.vehicles['X']['y']
        l = self.vehicles['X']['length']
        return (x + l - 1) == (self.board_width - 1) and y == (self.board_height // 2 - 1)

    def printBoard(self):
        """Affiche le plateau sous forme lisible"""
        for row in self.board:
            print(' '.join(row))

    def successorFunction(self):
        """Génère tous les mouvements possibles (action, nouvel état) pour chaque véhicule,
        en déplaçant d'une ou plusieurs cases en une seule action."""
        successors = []

        for vid, data in self.vehicles.items():
            x, y, o, l = data['x'], data['y'], data['orientation'], data['length']

            if o == 'H':
                # Vers la gauche (peut avancer de plusieurs cases)
                step = 1
                while x - step >= 0 and self.board[y][x - step] == ' ':
                    new_state = self._move_multistep(vid, -step, 0)
                    successors.append(((vid, 'left', step), new_state))
                    step += 1

                # Vers la droite
                step = 1
                while (x + l - 1 + step) < self.board_width and self.board[y][x + l - 1 + step] == ' ':
                    new_state = self._move_multistep(vid, step, 0)
                    successors.append(((vid, 'right', step), new_state))
                    step += 1

            elif o == 'V':
                # Vers le haut
                step = 1
                while y - step >= 0 and self.board[y - step][x] == ' ':
                    new_state = self._move_multistep(vid, 0, -step)
                    successors.append(((vid, 'up', step), new_state))
                    step += 1

                # Vers le bas
                step = 1
                while (y + l - 1 + step) < self.board_height and self.board[y + l - 1 + step][x] == ' ':
                    new_state = self._move_multistep(vid, 0, step)
                    successors.append(((vid, 'down', step), new_state))
                    step += 1

        return successors

    def _move_multistep(self, vid, dx, dy):
        """Retourne un nouvel état après avoir déplacé un véhicule de dx, dy (plusieurs cases)."""
        new_puzzle = RushHourPuzzle()
        new_puzzle.board_height = self.board_height
        new_puzzle.board_width = self.board_width
        new_puzzle.walls = self.walls.copy()

        # copie profonde des véhicules
        new_puzzle.vehicles = {v: data.copy() for v, data in self.vehicles.items()}

        # déplacer le véhicule
        new_puzzle.vehicles[vid]['x'] += dx
        new_puzzle.vehicles[vid]['y'] += dy

        # reconstruire le plateau
        new_puzzle.setBoard()
        return new_puzzle




class Node:
    def __init__(self, state, parent=None, action=None, g=0, f=0):
        self.state = state
        self.parent = parent
        self.action = action
        self.g = g
        self.f = f

    def __lt__(self, other):
        return self.f < other.f
    
    def getPath(self):
        """Reconstruit et retourne la séquence d’états depuis la racine jusqu’à ce nœud"""
        node = self
        path = []
        while node is not None:
            path.append(node.state)
            node = node.parent
        path.reverse()
        return path
    
    def getSolution(self):
        """Retourne la liste des actions effectuées pour atteindre cet état depuis l’état initial"""
        node = self
        actions = []
        while node.parent is not None:
            actions.append(node.action)
            node = node.parent
        actions.reverse()
        return actions
    
    def setF(self, heuristic):
        self.f = self.g + heuristic(self.state)


def BFS(s, successorsFn, isGoal):
    """Algorithme de recherche en largeur (Breadth-First Search)"""
    # Initialisation
    Open = deque()
    Closed = set()  # Utiliser un set pour des recherches O(1)

    init_node = Node(s, None, None)

    # Compteurs
    generated = 0  # Nombre d’états générés
    expanded = 0   # Nombre d’états développés
    start_time = time.time()

    # Test si l'état initial est le but
    if isGoal(init_node.state):
        elapsed = time.time() - start_time
        print(f"⏱ Temps d'exécution BFS : {elapsed:.4f}s")
        print(f"🧩 États générés : {generated}, développés : {expanded}")
        return init_node

    Open.append(init_node)
    generated +=1

    # Boucle principale
    while len(Open) > 0:
        current = Open.popleft()  # Choisir le nœud le plus à gauche (FIFO)
        expanded +=1
        Closed.add(current.state)  # Ajouter l'état à Closed (pas le nœud)

        # Pour chaque successeur
        for (action, successor) in successorsFn(current.state):
            child = Node(successor, current, action, current.g + 1)
            generated +=1

            # Test si c'est le but
            if isGoal(child.state):
                elapsed = time.time() - start_time
                print("\n=== 📊 COMPLEXITÉ BFS ===")
                print(f"⏱ Temps d'exécution : {elapsed:.4f} s")
                print(f"🔹 États générés : {generated}")
                print(f"🔹 États développés : {expanded}")
                print(f"🔹 Taille finale de la file : {len(Open)}")
                return child

            # Vérifier si l'état n'est pas déjà visité ou en attente
            if (child.state not in Closed and 
                not any(node.state == child.state for node in Open)):
                Open.append(child)

    # Aucune solution trouvée
    elapsed = time.time() - start_time
    print("\n❌ Aucune solution trouvée.")
    print(f"⏱ Temps d'exécution : {elapsed:.4f} s")
    print(f"🔹 États générés : {generated}")
    print(f"🔹 États développés : {expanded}")
    return None


# Heuristique h1 : distance horizontale jusqu’à la sortie (sans pénalité pour les bloqueurs)
def h1(state):
    x = state.vehicles['X']['x']
    l = state.vehicles['X']['length']
    return state.board_width - (x + l)


# h2 : h1 + nombre de véhicules bloqueurs uniques (plus douce, avec epsilon pour briser les égalités)
def h2(state):
    base = h1(state)
    y = state.vehicles['X']['y']
    x_start = state.vehicles['X']['x'] + state.vehicles['X']['length']
    blockers = set()
    for xx in range(x_start, state.board_width):
        cell = state.board[y][xx]
        if cell != ' ' and cell != 'X':
            blockers.add(cell)
    return base + len(blockers) + 1e-6 * len(blockers)


# h3 : h1 + somme des distances minimales pour que chaque véhicule bloqueur se dégage (plus efficace)
def h3(state):
    base = h1(state)
    y = state.vehicles['X']['y']
    x_start = state.vehicles['X']['x'] + state.vehicles['X']['length']
    blockers = set()
    total_penalty = 0
    for xx in range(x_start, state.board_width):
        cell = state.board[y][xx]
        if cell != ' ' and cell != 'X' and cell not in blockers:
            blockers.add(cell)
            veh_data = state.vehicles[cell]
            veh_length = veh_data['length']
            veh_x = veh_data['x']
            # Distance pour que ce véhicule se dégage complètement (vers la droite)
            dist_to_clear = state.board_width - (veh_x + veh_length)
            total_penalty += dist_to_clear
    return base + total_penalty + 1e-6 * total_penalty


# -----------------------------------------------------------
#  Algorithme A* générique
# -----------------------------------------------------------


def AStar(s, successorsFn, isGoal, h):
    """Implémentation de l'algorithme A*"""
    Open = []
    Closed = []

    init_node = Node(s, None, None, g=0)
    init_node.f = init_node.g + h(init_node.state)
    heapq.heappush(Open, (init_node.f, init_node))

    generated = 1
    expanded = 0
    start_time = time.time()

    while Open:
        _, current = heapq.heappop(Open)
        expanded += 1

        if isGoal(current.state):
            elapsed = time.time() - start_time
            print("\n=== 📊 COMPLEXITÉ A* ===")
            print(f"⏱ Temps d'exécution : {elapsed:.4f} s")
            print(f"🔹 États générés : {generated}")
            print(f"🔹 États développés : {expanded}")
            print(f"🔹 Taille finale de la file : {len(Open)}")
            return current

        Closed.append(current)

        for (action, successor) in successorsFn(current.state):
            child = Node(successor, current, action, current.g + 1)
            child.f = child.g + h(child.state) # a modifier en appelant la fonction setf

            # Vérifier doublons
            in_open = next((n for (_, n) in Open if n.state == child.state), None)
            in_closed = next((n for n in Closed if n.state == child.state), None)

            if not in_open and not in_closed:
                heapq.heappush(Open, (child.f, child))
                generated += 1
            elif in_open and child.f < in_open.f:
                Open.remove((in_open.f, in_open))
                heapq.heapify(Open)
                heapq.heappush(Open, (child.f, child))
            elif in_closed and child.f < in_closed.f:
                Closed.remove(in_closed)
                heapq.heappush(Open, (child.f, child))
                generated += 1

    elapsed = time.time() - start_time
    print("\n❌ Aucune solution trouvée par A*.")
    print(f"⏱ Temps d'exécution : {elapsed:.4f} s")
    print(f"🔹 États générés : {generated}")
    print(f"🔹 États développés : {expanded}")
    return None