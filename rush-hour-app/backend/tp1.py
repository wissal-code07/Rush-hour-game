import csv
from collections import deque
import heapq
import itertools

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

    # Test si l'état initial est le but
    if isGoal(init_node.state):
        return init_node

    Open.append(init_node)

    # Boucle principale
    while len(Open) > 0:
        current = Open.popleft()  # Choisir le nœud le plus à gauche (FIFO)
        Closed.add(current.state)  # Ajouter l'état à Closed (pas le nœud)

        # Pour chaque successeur
        for (action, successor) in successorsFn(current.state):
            child = Node(successor, current, action, current.g + 1)

            # Test si c'est le but
            if isGoal(child.state):
                return child

            # Vérifier si l'état n'est pas déjà visité ou en attente
            if (child.state not in Closed and 
                not any(node.state == child.state for node in Open)):
                Open.append(child)

    # Aucune solution trouvée
    return None

# -----------------------------------------------------------
# 🌟 Heuristique h1 : distance horizontale jusqu’à la sortie
# -----------------------------------------------------------
# h1 : distance horizontale
def h1(state):
    x = state.vehicles['X']['x']
    l = state.vehicles['X']['length']
    y = state.vehicles['X']['y']
    dist = state.board_width - (x + l)
    blockers = sum(1 for xx in range(x + l, state.board_width) if state.board[y][xx] != ' ')
    return dist + 0.001 * blockers


# h2 : distance + 0.5 × nb bloqueurs (plus douce)
def h2(state):
    base = h1(state)
    y = state.vehicles['X']['y']
    x = state.vehicles['X']['x'] + state.vehicles['X']['length']
    blockers = 0
    while x < state.board_width:
        cell = state.board[y][x]
        if cell != ' ' and cell != 'X':
            blockers += 1
        x += 1
    # petite perturbation pour briser les égalités
    return base + blockers + 1e-6 * blockers

# h3 : distance + 0.7 × nb bloqueurs (plus "agressive" mais encore admissible)
def h3(state):
    base = h1(state)
    y = state.vehicles['X']['y']
    x = state.vehicles['X']['x'] + state.vehicles['X']['length']
    blockers = 0
    while x < state.board_width:
        cell = state.board[y][x]
        if cell != ' ' and cell != 'X':
            blockers += 1
        x += 1
    return base + 0.7 * blockers


# -----------------------------------------------------------
# 🧱 Heuristique h3 : h1 + 2 × (nb véhicules bloquants)
# -----------------------------------------------------------
def h3(state):
    base = h1(state)
    y = state.vehicles['X']['y']
    x = state.vehicles['X']['x'] + state.vehicles['X']['length']
    blockers = 0
    while x < state.board_width:
        cell = state.board[y][x]
        if cell != ' ' and cell != 'X':
            blockers += 1
        x += 1
    return base + 2 * blockers


# -----------------------------------------------------------
# 🚀 Algorithme A* générique
# -----------------------------------------------------------
def A_star(start_state, heuristic):
    import itertools, heapq

    # File de priorité (min-heap)
    Open = []
    # g_score mémorise le coût du meilleur chemin connu vers chaque état
    g_score = {}
    counter = itertools.count()  # sert à casser les égalités entre nœuds

    # Nœud racine
    root = Node(start_state, None, None, g=0)
    root.setF(heuristic)

    start_key = str(root.state.vehicles)
    g_score[start_key] = 0

    # 🔹 On ajoute le nœud racine à la file
    heapq.heappush(Open, (root.f, next(counter), root))

    while Open:
        # On récupère le nœud ayant le plus petit f
        _, _, current = heapq.heappop(Open)
        current_key = str(current.state.vehicles)

        # ✅ Vérification du but
        if current.state.isGoal():
            return current

        # 🔁 Génération des successeurs
        for (action, successor) in current.state.successorFunction():
            cost = 1  # coût uniforme
            child = Node(successor, current, action, current.g + cost)
            child.setF(heuristic)
            child_key = str(child.state.vehicles)

            old_g = g_score.get(child_key, float('inf'))

            # Si meilleur chemin trouvé → on met à jour
            if child.g < old_g:
                g_score[child_key] = child.g
                # ⚙️ Ajout du "tie-breaker" pour éviter les égalités de f
                heapq.heappush(Open, (child.f + 1e-6 * child.g, next(counter), child))

    return None
